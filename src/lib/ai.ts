import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { TelemetrySettings } from "ai";

/**
 * OpenRouter client for AI SDK.
 * Uses OPENROUTER_API_KEY env var automatically.
 *
 * Model used: google/gemini-2.5-flash (fast, cheap, multilingual — good for Indonesian text)
 * Can be changed to any OpenRouter model via OPENROUTER_MODEL env var.
 *
 * NOTE: the fallback must be a model that currently exists on OpenRouter — the
 * previous default (google/gemini-2.0-flash) was retired and now errors out, so
 * an unset OPENROUTER_MODEL would break the whole AI pipeline.
 */
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  appName: "SalamDesk",
  appUrl: process.env.BETTER_AUTH_URL ?? "http://localhost:6767",
});

export const AI_MODEL =
  process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash";

export function getAiModel() {
  return openrouter(AI_MODEL);
}

/**
 * Standard `experimental_telemetry` config for Vercel AI SDK calls.
 * Pass to `generateObject`/`generateText` so each call is captured in Langfuse
 * with model, token usage, cost and latency.
 *
 * @param functionId  short, stable name shown in Langfuse (e.g. "classify-module")
 * @param metadata    extra trace attributes (ticketId, confidence, etc.)
 */
export function aiTelemetry(
  functionId: string,
  metadata?: TelemetrySettings["metadata"],
): TelemetrySettings {
  return { isEnabled: true, functionId, metadata };
}

/**
 * Confidence threshold for triggering an AI auto-reply.
 * Below this value → suggestion is shown to agents only, no auto-reply sent.
 */
export const AI_CONFIDENCE_THRESHOLD = 0.5;
