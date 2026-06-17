import { describe, expect, test } from "bun:test";
import { interpolate, extractJsonPath, isHostAllowed } from "./agent-tool-executor.service";

describe("tool executor helpers", () => {
  test("interpolate fills {placeholders}", () => {
    expect(interpolate("https://api/{id}/x", { id: "42" })).toBe("https://api/42/x");
  });
  test("interpolate leaves unknown placeholders empty", () => {
    expect(interpolate("a/{missing}", {})).toBe("a/");
  });
  test("extractJsonPath reads dot paths", () => {
    expect(extractJsonPath({ a: { b: 7 } }, "a.b")).toBe(7);
    expect(extractJsonPath({ a: 1 }, "")).toEqual({ a: 1 });
  });
  test("isHostAllowed enforces denylist of internal hosts", () => {
    expect(isHostAllowed("https://api.stripe.com/x")).toBe(true);
    expect(isHostAllowed("http://localhost:6767")).toBe(false);
    expect(isHostAllowed("http://169.254.169.254/latest")).toBe(false); // SSRF metadata
  });
});
