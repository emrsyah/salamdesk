import { describe, expect, test } from "bun:test";
import { canAutoReply } from "./auto-reply-policy.service";
import { DEFAULT_AI_CONFIG } from "./ai-config.service";

const base = {
  priority: "low" as const,
  suggestedReply: "hi",
  replyConfidence: 0.9,
  kbArticleId: "kb1",
  ticketText: "halo",
  source: "whatsapp",
  priorAutoReplies: 0,
};
const cfg = { ...DEFAULT_AI_CONFIG, requireKbGrounding: false };

describe("schedule gate", () => {
  test("draft-only window blocks auto-reply", () => {
    const config = {
      ...cfg,
      businessHours: {
        enabled: true,
        timezone: "Asia/Jakarta",
        defaultMode: "auto" as const,
        windows: [{ days: [3], start: "00:00", end: "23:59", mode: "draft-only" as const }],
      },
    };
    const d = canAutoReply(base, config, new Date("2026-06-17T03:00:00Z")); // Wed
    expect(d.allowed).toBe(false);
    expect(d.blockedReason).toMatch(/hours|jam|schedule|review/i);
  });

  test("auto window allows", () => {
    const config = {
      ...cfg,
      businessHours: {
        enabled: true,
        timezone: "Asia/Jakarta",
        defaultMode: "auto" as const,
        windows: [],
      },
    };
    expect(canAutoReply(base, config, new Date("2026-06-17T03:00:00Z")).allowed).toBe(true);
  });
});
