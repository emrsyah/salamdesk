/**
 * Langfuse / OpenTelemetry bootstrap.
 *
 * Every LLM call in SalamDesk goes through the Vercel AI SDK, which emits
 * OpenTelemetry spans when `experimental_telemetry` is enabled. The
 * `LangfuseSpanProcessor` intercepts those spans and ships them to Langfuse.
 *
 * Because the AI pipeline runs in TWO processes — the BullMQ worker
 * (`src/worker/index.ts`, where triage/procedures run) and the Next.js server
 * (copilot server actions) — `initObservability()` is called from both:
 *   - worker:  top of `src/worker/index.ts`, right after `dotenv/config`
 *   - Next.js: `src/instrumentation.ts` `register()`
 *
 * Requires LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY and LANGFUSE_BASE_URL in env.
 */
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { log } from "@/lib/logger";

const xlog = log("langfuse");

/**
 * Shared processor instance — exported so long-running/serverless callers can
 * force-flush buffered spans before the process (or request) ends.
 */
export const langfuseSpanProcessor = new LangfuseSpanProcessor();

let registered = false;

/**
 * Register the Langfuse span processor as the global OTEL tracer provider.
 * Idempotent: safe to call more than once within a process.
 */
export function initObservability(): void {
  if (registered) return;

  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
    // Don't crash the app if Langfuse isn't configured — just skip tracing.
    xlog.warn("LANGFUSE_PUBLIC_KEY/SECRET_KEY not set — tracing disabled");
    return;
  }

  const provider = new NodeTracerProvider({
    spanProcessors: [langfuseSpanProcessor],
  });
  provider.register();
  registered = true;
  xlog.info("OpenTelemetry tracing enabled");
}

/** Flush any buffered spans to Langfuse. Call before a process exits. */
export async function flushTraces(): Promise<void> {
  if (!registered) return;
  await langfuseSpanProcessor.forceFlush();
}
