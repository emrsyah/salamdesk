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

  test("isHostAllowed blocks numeric-encoded internal IPs", () => {
    expect(isHostAllowed("http://2130706433/")).toBe(false); // decimal 127.0.0.1
    expect(isHostAllowed("http://0177.0.0.1/")).toBe(false); // octal 127.0.0.1
    expect(isHostAllowed("http://127.1/")).toBe(false); // shorthand loopback
    expect(isHostAllowed("http://10.0.0.5/")).toBe(false); // private
  });

  test("isHostAllowed blocks internal IPv6 ranges", () => {
    expect(isHostAllowed("http://[::1]/")).toBe(false); // loopback
    expect(isHostAllowed("http://[fd00::1]/")).toBe(false); // ULA
    expect(isHostAllowed("http://[fe80::1]/")).toBe(false); // link-local
    expect(isHostAllowed("http://[::ffff:169.254.169.254]/")).toBe(false); // mapped metadata
  });

  test("isHostAllowed still allows normal public hosts", () => {
    expect(isHostAllowed("https://example.com/api")).toBe(true);
    expect(isHostAllowed("https://8.8.8.8/")).toBe(true);
  });
});
