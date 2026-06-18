import { test, expect } from "bun:test";
import { tryProcedure } from "./procedure-runtime.service";

const baseDeps = {
  listEnabled: async () => [
    {
      id: "p1",
      title: "Damaged order",
      whenToUse: "damaged food",
      content: { type: "doc", content: [] },
      enabled: true,
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  select: async () => ({ procedureId: "p1", confidence: 0.9, reasoning: "ok" }),
  loadKb: async () => [],
  buildTools: async () => ({}),
  run: async () => ({ reply: "Halo", action: "send" as const, toolCalls: 0, hadToolError: false }),
};

const behavior = { agentName: "A", persona: "", tone: "", language: "id", replySignature: "", guardrails: "" };

test("tryProcedure returns null when no procedure is selected", async () => {
  const res = await tryProcedure(
    { ticketText: "x", moduleName: null, behavior },
    { ...baseDeps, select: async () => null },
  );
  expect(res).toBeNull();
});

test("tryProcedure returns the executed reply + matched procedure", async () => {
  const res = await tryProcedure({ ticketText: "damaged", moduleName: "Pesanan", behavior }, baseDeps);
  expect(res?.reply).toBe("Halo");
  expect(res?.procedureId).toBe("p1");
  expect(res?.procedureTitle).toBe("Damaged order");
  expect(res?.action).toBe("send");
  expect(res?.confidence).toBe(0.9);
});

test("tryProcedure returns null when there are no enabled procedures", async () => {
  const res = await tryProcedure(
    { ticketText: "x", moduleName: null, behavior },
    { ...baseDeps, listEnabled: async () => [] },
  );
  expect(res).toBeNull();
});
