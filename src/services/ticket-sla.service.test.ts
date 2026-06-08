import { describe, expect, test } from "bun:test";
import {
  calculateSlaWarningAt,
  isHumanPublicStaffReply,
} from "./ticket-sla.service";

describe("ticket SLA helpers", () => {
  test("calculates warning at 80 percent elapsed", () => {
    const createdAt = new Date("2026-05-20T00:00:00.000Z");
    const dueAt = new Date("2026-05-20T10:00:00.000Z");
    expect(calculateSlaWarningAt(createdAt, dueAt).toISOString()).toBe(
      "2026-05-20T08:00:00.000Z",
    );
  });

  test("only public human staff replies satisfy first response", () => {
    expect(
      isHumanPublicStaffReply({ senderType: "staff", isInternalNote: false }),
    ).toBe(true);
    expect(
      isHumanPublicStaffReply({ senderType: "staff", isInternalNote: true }),
    ).toBe(false);
    expect(
      isHumanPublicStaffReply({
        senderType: "ai_agent",
        isInternalNote: false,
      }),
    ).toBe(false);
    expect(
      isHumanPublicStaffReply({ senderType: "system", isInternalNote: false }),
    ).toBe(false);
  });
});
