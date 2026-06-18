import { test, expect } from "bun:test";
import { buildSelectionPrompt, pickProcedure } from "./procedure-selection.service";

const procs = [
  { id: "p1", title: "Damaged order", whenToUse: "customer reports a damaged/spilled food order" },
  { id: "p2", title: "Refund status", whenToUse: "customer asks where their refund is" },
];

test("buildSelectionPrompt lists every candidate with id + when_to_use", () => {
  const p = buildSelectionPrompt("My food arrived crushed", procs);
  expect(p).toContain("p1");
  expect(p).toContain("damaged/spilled food order");
  expect(p).toContain("My food arrived crushed");
});

test("pickProcedure returns the model's choice when confident", async () => {
  const fakeGenerate = async () => ({ object: { procedureId: "p1", confidence: 0.9, reasoning: "match" } });
  const res = await pickProcedure("crushed food", procs, { generate: fakeGenerate, minConfidence: 0.6 });
  expect(res?.procedureId).toBe("p1");
});

test("pickProcedure returns null below the confidence floor", async () => {
  const fakeGenerate = async () => ({ object: { procedureId: "p1", confidence: 0.3, reasoning: "weak" } });
  const res = await pickProcedure("crushed food", procs, { generate: fakeGenerate, minConfidence: 0.6 });
  expect(res).toBeNull();
});

test("pickProcedure returns null when the model declines (null id)", async () => {
  const fakeGenerate = async () => ({ object: { procedureId: null, confidence: 0, reasoning: "none" } });
  const res = await pickProcedure("hello", procs, { generate: fakeGenerate, minConfidence: 0.6 });
  expect(res).toBeNull();
});

test("pickProcedure short-circuits with no candidates (no model call)", async () => {
  let called = false;
  const fakeGenerate = async () => {
    called = true;
    return { object: { procedureId: null, confidence: 0, reasoning: "" } };
  };
  const res = await pickProcedure("anything", [], { generate: fakeGenerate, minConfidence: 0.6 });
  expect(res).toBeNull();
  expect(called).toBe(false);
});

test("pickProcedure rejects a hallucinated id not in the candidate set", async () => {
  const fakeGenerate = async () => ({ object: { procedureId: "p9", confidence: 0.99, reasoning: "made up" } });
  const res = await pickProcedure("x", procs, { generate: fakeGenerate, minConfidence: 0.6 });
  expect(res).toBeNull();
});
