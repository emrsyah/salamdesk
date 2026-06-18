import { test, expect } from "bun:test";
import {
  PROCEDURE_MENTION_KINDS,
  emptyProcedureContent,
  extractMentions,
  collectRefIds,
  serializeContentToText,
  type ProcedureContent,
} from "./procedure-content";

const doc: ProcedureContent = {
  type: "doc",
  content: [
    {
      type: "orderedList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Acknowledge the issue, then " },
                { type: "mention", attrs: { kind: "tool", refId: "tool-1", label: "Get order info" } },
                { type: "text", text: " and ground in " },
                { type: "mention", attrs: { kind: "kb", refId: "kb-9", label: "Refund policy" } },
              ],
            },
          ],
        },
      ],
    },
  ],
};

test("kinds are the four agreed categories", () => {
  expect([...PROCEDURE_MENTION_KINDS]).toEqual(["tool", "kb", "module", "time"]);
});

test("emptyProcedureContent is a valid empty doc", () => {
  expect(emptyProcedureContent().type).toBe("doc");
});

test("extractMentions walks the whole tree depth-first", () => {
  const mentions = extractMentions(doc);
  expect(mentions.map((m) => m.kind)).toEqual(["tool", "kb"]);
  expect(mentions.map((m) => m.refId)).toEqual(["tool-1", "kb-9"]);
});

test("collectRefIds dedupes by kind", () => {
  expect(collectRefIds(doc, "tool")).toEqual(["tool-1"]);
  expect(collectRefIds(doc, "kb")).toEqual(["kb-9"]);
  expect(collectRefIds(doc, "module")).toEqual([]);
});

test("serializeContentToText renders mentions as readable tokens and numbers steps", () => {
  const text = serializeContentToText(doc);
  expect(text).toContain("1. Acknowledge the issue, then [Tool: Get order info] and ground in [KB: Refund policy]");
});

test("serializeContentToText is robust to malformed/empty input", () => {
  expect(serializeContentToText(emptyProcedureContent())).toBe("");
  expect(serializeContentToText({} as ProcedureContent)).toBe("");
});
