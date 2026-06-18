import { test, expect } from "bun:test";
import { assembleSystemPrompt, runProcedure, MAX_PROCEDURE_STEPS } from "./procedure-execution.service";

const behavior = {
  agentName: "Asisten",
  persona: "Ramah",
  tone: "Sopan",
  language: "id",
  replySignature: "- Tim Support",
  guardrails: "Jangan janjikan refund.",
};

test("assembleSystemPrompt embeds behavior, steps text, and KB grounding", () => {
  const sys = assembleSystemPrompt({
    behavior,
    procedureTitle: "Damaged order",
    stepsText: "1. Acknowledge\n2. [Tool: Get order info]",
    kbGrounding: [{ title: "Refund policy", content: "Refunds within 7 days." }],
    moduleName: "Pesanan",
  });
  expect(sys).toContain("Asisten");
  expect(sys).toContain("Damaged order");
  expect(sys).toContain("Get order info");
  expect(sys).toContain("Refunds within 7 days");
  expect(sys).toContain("Jangan janjikan refund");
  expect(sys).toContain("Pesanan");
});

test("runProcedure returns the model text as the reply and counts tool calls", async () => {
  const fakeGenerate = async () => ({
    text: "Halo, kami akan bantu.",
    steps: [{ toolCalls: [{ toolName: "get_order" }], toolResults: [{ output: { ok: true } }] }],
  });
  const res = await runProcedure({
    ticketText: "Pesanan rusak",
    behavior,
    procedureTitle: "x",
    stepsText: "1. acknowledge",
    kbGrounding: [],
    moduleName: null,
    tools: {},
    generate: fakeGenerate,
  });
  expect(res.reply).toBe("Halo, kami akan bantu.");
  expect(res.toolCalls).toBe(1);
  expect(res.hadToolError).toBe(false);
  expect(res.action).toBe("send");
});

test("runProcedure flags a tool error so the caller can force draft-only", async () => {
  const fakeGenerate = async () => ({
    text: "draft",
    steps: [{ toolCalls: [{ toolName: "get_order" }], toolResults: [{ output: { ok: false, error: "boom" } }] }],
  });
  const res = await runProcedure({
    ticketText: "x",
    behavior,
    procedureTitle: "x",
    stepsText: "x",
    kbGrounding: [],
    moduleName: null,
    tools: {},
    generate: fakeGenerate,
  });
  expect(res.hadToolError).toBe(true);
  expect(res.action).toBe("draft-only");
});

test("MAX_PROCEDURE_STEPS is a small bound", () => {
  expect(MAX_PROCEDURE_STEPS).toBeLessThanOrEqual(6);
});
