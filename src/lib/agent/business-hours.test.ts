import { describe, expect, test } from "bun:test";
import { resolveReplyMode, type BusinessHours } from "./business-hours";

const hours: BusinessHours = {
  enabled: true,
  timezone: "Asia/Jakarta",
  defaultMode: "auto", // after hours → autopilot
  windows: [{ days: [1, 2, 3, 4, 5], start: "08:00", end: "17:00", mode: "draft-only" }],
};

describe("resolveReplyMode", () => {
  test("inside a window uses the window mode", () => {
    // Wed 2026-06-17 10:00 Asia/Jakarta == 03:00Z
    expect(resolveReplyMode(hours, new Date("2026-06-17T03:00:00Z"))).toBe("draft-only");
  });
  test("outside windows uses defaultMode", () => {
    // Wed 2026-06-17 22:00 Asia/Jakarta == 15:00Z
    expect(resolveReplyMode(hours, new Date("2026-06-17T15:00:00Z"))).toBe("auto");
  });
  test("disabled schedule always returns auto", () => {
    expect(resolveReplyMode({ ...hours, enabled: false }, new Date("2026-06-17T03:00:00Z"))).toBe("auto");
  });
});
