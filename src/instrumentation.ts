/**
 * Next.js instrumentation hook — runs once on server startup.
 * Initializes Langfuse/OpenTelemetry so copilot server actions
 * (refine reply, draft from KB) get traced. The BullMQ worker has its own
 * bootstrap in `src/worker/index.ts`.
 *
 * https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
export async function register() {
  // Skip the edge runtime — Langfuse's OTEL setup is Node-only.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initObservability } = await import("@/lib/langfuse");
    initObservability();
  }
}
