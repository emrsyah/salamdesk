/**
 * Shared Pino logger for both runtimes.
 *
 *   - Next.js (Vercel):  NODE_ENV=production → raw JSON to stdout, which Vercel
 *     captures and forwards to any log drain (Axiom, Better Stack, …).
 *   - Worker (VPS):      same JSON to stdout, captured by `docker logs` and
 *     shippable from there.
 *
 * In development both emit colourised, human-readable lines via pino-pretty.
 * pino-pretty runs in a worker thread, so it is kept out of the bundle:
 *   - Next:   listed in `serverExternalPackages` (next.config.mjs)
 *   - Worker: tsup marks every dependency external by default
 * and it is only ever loaded when NODE_ENV !== "production".
 *
 * Usage:
 *   import { log } from "@/lib/logger";
 *   const tlog = log("triage");
 *   tlog.info({ ticketId }, "classifying ticket");
 *   const jlog = tlog.child({ jobId });   // per-job correlation
 */
import pino, { type Logger, type LoggerOptions } from "pino";

const isProd = process.env.NODE_ENV === "production";

// Distinguishes "web" (Vercel) from "worker" (VPS) once both streams are pooled
// in a log platform. NEXT_RUNTIME is set inside the Next.js server runtime only.
const service =
  process.env.LOG_SERVICE ?? (process.env.NEXT_RUNTIME ? "web" : "worker");

const options: LoggerOptions = {
  // LOG_LEVEL overrides per environment; verbose locally, info in prod.
  level: process.env.LOG_LEVEL ?? (isProd ? "info" : "debug"),
  base: { service },
  // ISO timestamps aggregate and sort more reliably than the default epoch ms.
  timestamp: pino.stdTimeFunctions.isoTime,
  // Defence-in-depth: strip common secret fields before a line is ever written.
  redact: {
    paths: [
      "password",
      "*.password",
      "token",
      "*.token",
      "accessToken",
      "*.accessToken",
      "apiKey",
      "*.apiKey",
      "authorization",
      "*.authorization",
      "headers.authorization",
      "headers.cookie",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
    censor: "[redacted]",
  },
  ...(isProd
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:HH:MM:ss.l",
            ignore: "pid,hostname",
            messageFormat: "{module} {msg}",
          },
        },
      }),
};

export const logger: Logger = pino(options);

/**
 * Namespaced child logger. Every line carries `module:"<name>"` plus any extra
 * bindings, so logs from one component are trivially filterable downstream.
 */
export function log(
  module: string,
  bindings: Record<string, unknown> = {},
): Logger {
  return logger.child({ module, ...bindings });
}
