import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { rm } from "node:fs/promises";
import pino from "pino";
import { waInboundQueue, type WaInboundJob } from "./queue";
import { normalisePhone } from "@/services/whatsapp.service";
import { redisConnection } from "./redis";

const AUTH_DIR = "./wa_auth";

const logger = pino({ level: "silent" });

let sock: WASocket | null = null;
let isConnecting = false;
// Set while a UI-initiated disconnect is in flight, so the resulting
// `loggedOut` close event doesn't clobber the fresh reconnect status.
let intentionalDisconnect = false;

/**
 * Returns the active Baileys socket, or null if not yet connected.
 * Used by the outbound worker to call sock.sendMessage().
 */
export function getSocket(): WASocket | null {
  return sock;
}

/**
 * Resolve a human-readable phone number from an addressing JID.
 *
 * For "<phone>@s.whatsapp.net" this is just the local part. For "<id>@lid"
 * (WhatsApp's anonymised identifier, default since v7) we consult Baileys'
 * LID↔PN mapping store. That mapping is only populated when WhatsApp has
 * shared it (e.g. via group activity or onWhatsApp lookups), so it can be
 * unavailable — in which case we fall back to the LID's local part.
 *
 * The returned value is for display/profiles only. Always reply to the full
 * JID, never to `${phone}@s.whatsapp.net`.
 */
export async function resolvePhone(jid: string): Promise<string> {
  if (jid.endsWith("@lid") && sock) {
    try {
      const pn = await sock.signalRepository.lidMapping.getPNForLID(jid);
      if (pn) return normalisePhone(pn);
    } catch (err) {
      console.error(`[WA] Failed to resolve PN for LID ${jid}:`, err);
    }
  }
  return normalisePhone(jid);
}

/**
 * Disconnect the currently linked WhatsApp account.
 *
 * Triggered cross-process from the web app via the "wa-control" Redis channel.
 * Steps:
 *   1. `sock.logout()` — unlinks the device on WhatsApp's side.
 *   2. Wipe the local auth state so we don't reuse the dead session.
 *   3. Reconnect, which produces a fresh QR for re-linking from the UI.
 */
export async function disconnectWhatsApp(): Promise<void> {
  console.log("[WA] Disconnect requested — logging out…");
  intentionalDisconnect = true;
  try {
    if (sock) {
      await sock.logout();
    }
  } catch (err) {
    // Logout can throw if the socket is already half-closed; we still want to
    // continue clearing local state below.
    console.error("[WA] Error during logout (continuing cleanup):", err);
  }

  sock = null;
  isConnecting = false;

  try {
    await rm(AUTH_DIR, { recursive: true, force: true });
  } catch (err) {
    console.error("[WA] Failed to clear auth directory:", err);
  }

  // Independent key resets — run them together.
  await Promise.all([
    redisConnection.del("wa-qr"),
    redisConnection.del("wa-account"),
    redisConnection.del("wa-connected-at"),
    redisConnection.set("wa-status", "connecting"),
  ]);

  // Reconnect with a clean slate so a new QR is generated for re-linking.
  connectToWhatsApp().catch((err) => {
    console.error("[WA] Failed to reconnect after disconnect:", err);
  });
}

/**
 * Boot the Baileys WhatsApp connection.
 * - On first run: prints a QR code to the terminal for scanning.
 * - On subsequent runs: reconnects from saved auth state automatically.
 * - On disconnect (non-logout): reconnects automatically with exponential backoff.
 *
 * Incoming messages are pushed to the wa-inbound BullMQ queue.
 */
export async function connectToWhatsApp(): Promise<void> {
  if (isConnecting) return;
  isConnecting = true;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      logger,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      printQRInTerminal: true,
      markOnlineOnConnect: false,
      // Prevent message store bloat in long-running process
      getMessage: async () => undefined,
    });

    // Persist credentials whenever they update (key rotation, etc.)
    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
      isConnecting = false;

      if (qr) {
        // A fresh QR means the (possibly intentional) disconnect has completed.
        intentionalDisconnect = false;
        console.log("\n[WA] Scan the QR code above to link your WhatsApp account.\n");
        // Save QR to Redis for frontend to display
        await redisConnection.set("wa-qr", qr, "EX", 120); // expires in 120 seconds
        await redisConnection.set("wa-status", "qr");
      }

      if (connection === "open") {
        intentionalDisconnect = false;
        console.log("[WA] Connected to WhatsApp ✓");
        await redisConnection.del("wa-qr");
        await redisConnection.set("wa-status", "connected");

        // Persist the linked account so the web UI can show which number is
        // connected. `sock.user.id` looks like "<number>:<device>@s.whatsapp.net";
        // we keep just the dialable number for display.
        const userId = sock?.user?.id ?? "";
        const number = userId.split(":")[0]?.split("@")[0] ?? "";
        await redisConnection.set(
          "wa-account",
          JSON.stringify({ number, name: sock?.user?.name ?? null }),
        );
        // Only stamp connected-at on a fresh link, not on every silent
        // reconnect, so the UI shows true session uptime.
        const existingSince = await redisConnection.get("wa-connected-at");
        if (!existingSince) {
          await redisConnection.set("wa-connected-at", new Date().toISOString());
        }
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        console.log(
          `[WA] Connection closed (code: ${statusCode}). ${loggedOut ? "Logged out — delete ./wa_auth and restart." : "Reconnecting…"}`,
        );

        // The linked account is gone the moment the socket closes; clear it so
        // the UI never shows a stale number during reconnect/QR.
        await redisConnection.del("wa-account");
        await redisConnection.del("wa-connected-at");

        if (loggedOut) {
          // Skip when we triggered the logout ourselves — disconnectWhatsApp()
          // is already steering the status toward a fresh reconnect.
          if (!intentionalDisconnect) {
            await redisConnection.set("wa-status", "logged_out");
          }
        } else {
          await redisConnection.set("wa-status", "connecting");
          // Exponential backoff: wait up to 30 s before reconnecting
          const delay = Math.min(
            (sock as any)?._reconnectDelay ?? 1000,
            30_000,
          );
          setTimeout(() => connectToWhatsApp(), delay);
        }
      }
    });

    // Route incoming messages to the BullMQ wa-inbound queue
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      // "notify" = a new message arrived; "append" = from history sync, skip
      if (type !== "notify") return;

      for (const msg of messages) {
        // Ignore messages sent by us (fromMe) and status broadcasts
        if (msg.key.fromMe) continue;
        if (msg.key.remoteJid === "status@broadcast") continue;

        const jid = msg.key.remoteJid;
        if (!jid) continue;

        // Only triage private (1:1) chats. Group messages (JIDs ending in
        // "@g.us") are noisy and not meant to become tickets.
        if (jid.endsWith("@g.us")) continue;

        // Extract plain text (supports text messages; media comes later in Phase 5+)
        const text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          "";

        if (!text.trim()) continue; // Ignore media-only messages for now

        // Since Baileys v7 / WhatsApp's LID system, 1:1 chats often arrive as
        // "<id>@lid" instead of "<phone>@s.whatsapp.net". We reply to the full
        // `jid` verbatim, and best-effort resolve a human-readable phone number
        // for the requester profile (LID→PN is not always available).
        const phone = await resolvePhone(jid);
        const pushName = msg.pushName ?? null;
        const messageId = msg.key.id ?? "";

        const job: WaInboundJob = { jid, phone, text, pushName, messageId };

        await waInboundQueue.add("inbound", job, {
          // Deduplicate by WA message ID to be idempotent
          jobId: `wa-msg-${messageId}`,
        });

        console.log(`[WA] Queued inbound message from ${jid}: "${text.slice(0, 50)}"`);
      }
    });
  } catch (err) {
    isConnecting = false;
    console.error("[WA] Fatal error during connection setup:", err);
    throw err;
  }
}
