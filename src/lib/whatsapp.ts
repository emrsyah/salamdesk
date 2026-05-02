import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import { waInboundQueue, type WaInboundJob } from "./queue";
import { normalisePhone } from "@/services/whatsapp.service";
import { redisConnection } from "./redis";

const AUTH_DIR = "./wa_auth";

const logger = pino({ level: "silent" });

let sock: WASocket | null = null;
let isConnecting = false;

/**
 * Returns the active Baileys socket, or null if not yet connected.
 * Used by the outbound worker to call sock.sendMessage().
 */
export function getSocket(): WASocket | null {
  return sock;
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
        console.log("\n[WA] Scan the QR code above to link your WhatsApp account.\n");
        // Save QR to Redis for frontend to display
        await redisConnection.set("wa-qr", qr, "EX", 120); // expires in 120 seconds
        await redisConnection.set("wa-status", "qr");
      }

      if (connection === "open") {
        console.log("[WA] Connected to WhatsApp ✓");
        await redisConnection.del("wa-qr");
        await redisConnection.set("wa-status", "connected");
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        console.log(
          `[WA] Connection closed (code: ${statusCode}). ${loggedOut ? "Logged out — delete ./wa_auth and restart." : "Reconnecting…"}`,
        );

        if (loggedOut) {
          await redisConnection.set("wa-status", "logged_out");
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

        // Extract plain text (supports text messages; media comes later in Phase 5+)
        const text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          "";

        if (!text.trim()) continue; // Ignore media-only messages for now

        const phone = normalisePhone(jid);
        const pushName = msg.pushName ?? null;
        const messageId = msg.key.id ?? "";

        const job: WaInboundJob = { phone, text, pushName, messageId };

        await waInboundQueue.add("inbound", job, {
          // Deduplicate by WA message ID to be idempotent
          jobId: `wa-msg-${messageId}`,
        });

        console.log(`[WA] Queued inbound message from ${phone}: "${text.slice(0, 50)}"`);
      }
    });
  } catch (err) {
    isConnecting = false;
    console.error("[WA] Fatal error during connection setup:", err);
    throw err;
  }
}
