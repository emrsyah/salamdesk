import { test, expect } from "bun:test";
import { normalizeProcedureInput } from "./agent-procedures.service";

test("normalizeProcedureInput trims title/whenToUse and defaults content", () => {
  const out = normalizeProcedureInput({ title: "  Damaged order  ", whenToUse: "  use when... ", content: undefined });
  expect(out.title).toBe("Damaged order");
  expect(out.whenToUse).toBe("use when...");
  expect(out.content).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
});

test("normalizeProcedureInput rejects an empty title", () => {
  expect(() => normalizeProcedureInput({ title: "   ", whenToUse: "x", content: {} })).toThrow();
});
