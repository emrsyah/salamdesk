import { createOpenRouter } from "@openrouter/ai-sdk-provider";

/**
 * OpenRouter client for AI SDK.
 * Uses OPENROUTER_API_KEY env var automatically.
 *
 * Model used: google/gemini-2.0-flash (fast, cheap, multilingual — good for Indonesian text)
 * Can be changed to any OpenRouter model via OPENROUTER_MODEL env var.
 */
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  appName: "SalamDesk",
  appUrl: process.env.BETTER_AUTH_URL ?? "http://localhost:6767",
});

export const AI_MODEL =
  process.env.OPENROUTER_MODEL ?? "google/gemini-2.0-flash";

export function getAiModel() {
  return openrouter(AI_MODEL);
}

/**
 * Confidence threshold for triggering an AI auto-reply.
 * Below this value → suggestion is shown to agents only, no auto-reply sent.
 */
export const AI_CONFIDENCE_THRESHOLD = 0.5;
