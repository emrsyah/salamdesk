import makeWASocket, {
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  getContentType,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  type WAMessage,
  type WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { rm, readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";
import pino from "pino";
import qrcode from "qrcode-terminal";
import { UTApi } from "uploadthing/server";
import { waInboundQueue, type WaInboundAttachment, type WaInboundJob } from "./queue";
import { normalisePhone } from "@/services/whatsapp.service";
import { redisConnection } from "./redis";

const AUTH_DIR = "./wa_auth";

/**
 * Wipe the saved WhatsApp auth credentials.
 *
 * Clears the *contents* of AUTH_DIR rather than the directory itself: in the
 * VPS deployment AUTH_DIR is a Docker volume mount point (see
 * docker-compose.worker.yml), and removing a mount point throws EBUSY. Deleting
 * the entries inside leaves a clean, empty dir that useMultiFileAuthState can
 * repopulate with a fresh session.
 */
async function clearAuthState(): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(AUTH_DIR);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      await mkdir(AUTH_DIR, { recursive: true });
      return;
    }
    throw err;
  }
  await Promise.all(
    entries.map((entry) => rm(join(AUTH_DIR, entry), { recursive: true, force: true })),
  );
}

const logger = pino({ level: "silent" });

// Server-side UploadThing client for re-hosting inbound WhatsApp media so it has
// a stable public URL (for the ticket thread UI and for vision LLM calls).
const utapi = new UTApi({ token: process.env.UPLOADTHING_TOKEN });

/**
 * Download an inbound image from WhatsApp and re-host it on UploadThing,
 * returning an attachment record ready to persist. Best-effort: returns null on
 * any failure so a media hiccup never blocks ticket creation.
 */
async function downloadAndStoreWaMedia(
  msg: WAMessage,
  messageId: string,
): Promise<WaInboundAttachment | null> {
  try {
    const buffer = (await downloadMediaMessage(
      msg,
      "buffer",
      {},
      { logger, reuploadRequest: sock!.updateMediaMessage },
    )) as Buffer;

    const mimeType = msg.message?.imageMessage?.mimetype ?? "image/jpeg";
    const rawExt = mimeType.split("/")[1]?.split(";")[0] || "jpg";
    const ext = rawExt === "jpeg" ? "jpg" : rawExt;
    const fileName = `wa-${messageId}.${ext}`;

    // Slice out a plain ArrayBuffer backing (a Node Buffer's ArrayBufferLike
    // isn't a valid BlobPart under strict lib types).
    const bytes = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;
    const file = new File([bytes], fileName, { type: mimeType });
    const res = await utapi.uploadFiles(file);
    if (res.error || !res.data) {
      console.error(`[WA] Media upload failed for ${messageId}:`, res.error);
      return null;
    }

    return {
      fileName,
      fileUrl: res.data.ufsUrl,
      storageKey: res.data.key,
      mimeType,
      fileSize: res.data.size ?? buffer.length,
    };
  } catch (err) {
    console.error(`[WA] Failed to download/store media for ${messageId}:`, err);
    return null;
  }
}

let sock: WASocket | null = null;
let isConnecting = false;
let isConnected = false;
// Set while a UI-initiated disconnect is in flight, so the resulting
// `loggedOut` close event doesn't clobber the fresh reconnect status.
let intentionalDisconnect = false;

/**
 * Returns the active Baileys socket, or null if not yet connected.
 * Used by the outbound worker to call sock.sendMessage().
 */
export function getSocket(): WASocket | null {
  return isConnected ? sock : null;
}

/**
 * Mark an inbound message as read (blue ticks), so the requester sees their
 * message was received the instant it lands — before any reply is composed.
 * Best-effort: never throws into the caller's pipeline.
 */
export async function markMessageRead(jid: string, messageId: string): Promise<void> {
  if (!messageId || !sock || !isConnected) return;
  try {
    await sock.readMessages([{ remoteJid: jid, id: messageId, fromMe: false }]);
  } catch (err) {
    console.error(`[WA] readMessages failed for ${jid}:`, err);
  }
}

/**
 * Toggle the "typing…" (composing) presence on a chat, so the conversation
 * feels live while the AI is thinking/about to reply. Pass `false` to clear it.
 * Best-effort: presence is cosmetic and must never break a send.
 */
export async function sendTypingPresence(jid: string, typing: boolean): Promise<void> {
  if (!sock || !isConnected) return;
  try {
    await sock.sendPresenceUpdate(typing ? "composing" : "paused", jid);
  } catch (err) {
    console.error(`[WA] presence update failed for ${jid}:`, err);
  }
}

/** Random integer pause in [minMs, maxMs] — for human-like, non-robotic timing. */
function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Acknowledge an inbound message the way a person would: a brief, randomized
 * beat before the blue ticks, then another beat before "typing…" appears —
 * rather than both firing the instant the message lands (which reads as a bot).
 * Sequenced so the read receipt always precedes typing. Kept short so it still
 * feels fast. Best-effort & fire-and-forget — callers should NOT await this.
 */
export async function acknowledgeInbound(jid: string, messageId: string): Promise<void> {
  // message arrives → (pause) → mark read
  await randomDelay(500, 1600);
  await markMessageRead(jid, messageId);
  // mark read → (pause) → start typing
  await randomDelay(400, 1100);
  await sendTypingPresence(jid, true);
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
  isConnected = false;

  try {
    await clearAuthState();
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
 * Re-link WhatsApp after a logout (401) without needing server access.
 *
 * The 401 close handler already wiped the dead ./wa_auth, so this just resets
 * the public status keys and reconnects — which emits a fresh QR for the admin
 * to scan from the UI. Triggered cross-process via the "wa-control" channel.
 */
export async function reconnectWhatsApp(): Promise<void> {
  console.log("[WA] Reconnect requested — generating a fresh QR…");
  intentionalDisconnect = false;

  // Defensive: ensure no stale creds survive if reconnect is triggered from a
  // state other than a fresh 401 (e.g. a session that got stuck).
  try {
    await clearAuthState();
  } catch (err) {
    console.error("[WA] Failed to clear auth directory before reconnect:", err);
  }

  await Promise.all([
    redisConnection.del("wa-qr"),
    redisConnection.set("wa-status", "connecting"),
  ]);

  await connectToWhatsApp();
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
        
        // Print QR code in terminal using qrcode-terminal
        qrcode.generate(qr, { small: true });

        // Save QR to Redis for frontend to display
        await redisConnection.set("wa-qr", qr, "EX", 120); // expires in 120 seconds
        await redisConnection.set("wa-status", "qr");
      }

      if (connection === "open") {
        intentionalDisconnect = false;
        isConnected = true;
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
        isConnected = false;
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        console.log(
          `[WA] Connection closed (code: ${statusCode}). ${loggedOut ? "Logged out — clearing dead session…" : "Reconnecting…"}`,
        );

        // The linked account is gone the moment the socket closes; clear it so
        // the UI never shows a stale number during reconnect/QR.
        await redisConnection.del("wa-account");
        await redisConnection.del("wa-connected-at");

        if (loggedOut) {
          // The device link is dead — these credentials will 401 again on every
          // reconnect, so wipe them now. This removes the manual "ssh in, delete
          // ./wa_auth, restart worker" step: a restart, or a UI-triggered
          // reconnect, now starts from a clean slate and produces a fresh QR.
          sock = null;
          try {
            await clearAuthState();
            console.log("[WA] Cleared ./wa_auth. Open the WhatsApp page and click 'Hubungkan ulang' to re-link.");
          } catch (err) {
            console.error("[WA] Failed to clear auth directory after logout:", err);
          }
          await redisConnection.del("wa-qr");

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

      // Collect this upsert's messages and enqueue them in one addBulk call
      // rather than an add() per message — fewer Redis round-trips on bursts.
      const jobs: { name: string; data: WaInboundJob; opts: { jobId: string } }[] = [];

      for (const msg of messages) {
        // Ignore messages sent by us (fromMe) and status broadcasts
        if (msg.key.fromMe) continue;
        if (msg.key.remoteJid === "status@broadcast") continue;

        const jid = msg.key.remoteJid;
        if (!jid) continue;

        // Only triage private (1:1) chats. Group messages (JIDs ending in
        // "@g.us") are noisy and not meant to become tickets.
        if (jid.endsWith("@g.us")) continue;

        // Plain text, or an image caption. Only images are "understood" for now;
        // other media (video/audio/document) is still skipped.
        const messageType = getContentType(msg.message ?? undefined);
        const isImage = messageType === "imageMessage";
        const text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          "";

        if (!text.trim() && !isImage) continue; // nothing usable yet

        const messageId = msg.key.id ?? "";

        // Re-host the image so it has a stable URL for the thread + vision calls.
        let attachments: WaInboundAttachment[] | undefined;
        if (isImage) {
          const stored = await downloadAndStoreWaMedia(msg, messageId);
          if (stored) attachments = [stored];
        }

        // Since Baileys v7 / WhatsApp's LID system, 1:1 chats often arrive as
        // "<id>@lid" instead of "<phone>@s.whatsapp.net". We reply to the full
        // `jid` verbatim, and best-effort resolve a human-readable phone number
        // for the requester profile (LID→PN is not always available).
        const phone = await resolvePhone(jid);
        const pushName = msg.pushName ?? null;

        const job: WaInboundJob = { jid, phone, text, pushName, messageId, attachments };

        jobs.push({
          name: "inbound",
          data: job,
          // Deduplicate by WA message ID to be idempotent
          opts: { jobId: `wa-msg-${messageId}` },
        });

        console.log(`[WA] Queued inbound message from ${jid}: "${text.slice(0, 50)}"`);
      }

      if (jobs.length > 0) {
        await waInboundQueue.addBulk(jobs);
      }
    });
  } catch (err) {
    isConnecting = false;
    console.error("[WA] Fatal error during connection setup:", err);
    throw err;
  }
}
