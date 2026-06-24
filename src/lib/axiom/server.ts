/**
 * Server-side Axiom logger + route-handler wrapper (web / Vercel).
 *
 * Wrap API route handlers with `withAxiom` to get the request lifecycle
 * (method, path, status, duration) and any thrown errors logged to Axiom
 * automatically — flushing is handled for you before the serverless function
 * freezes:
 *
 *   import { withAxiom } from "@/lib/axiom/server";
 *   export const GET = withAxiom(async (req) => { ... });
 *
 * For ad-hoc logging in server components / actions, use `logger` directly and
 * flush via `after()` so logs aren't dropped when the function suspends:
 *
 *   import { logger } from "@/lib/axiom/server";
 *   import { after } from "next/server";
 *   logger.info("ticket created", { ticketId });
 *   after(() => logger.flush());
 *
 * `service: "web"` is stamped on every line so these pool with the worker's
 * `service: "worker"` logs in the shared Axiom dataset — filter by `service`.
 */
import { Logger, AxiomJSTransport } from "@axiomhq/logging";
import { createAxiomRouteHandler, nextJsFormatters } from "@axiomhq/nextjs";
import type { NextRequest } from "next/server";
import axiomClient from "./axiom";

export const logger = new Logger({
  transports: [
    new AxiomJSTransport({
      axiom: axiomClient,
      dataset: process.env.AXIOM_DATASET!,
    }),
  ],
  formatters: nextJsFormatters,
});

export const withAxiom = createAxiomRouteHandler(logger, {
  store: (req: NextRequest) => ({
    service: "web",
    request_id: crypto.randomUUID(),
  }),
});
