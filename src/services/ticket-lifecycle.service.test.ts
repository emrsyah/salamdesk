import { describe, expect, test } from "bun:test";
import {
  canTransitionTicketStatus,
  normalizeTicketStatus,
} from "./ticket-lifecycle.types";

describe("ticket lifecycle status helpers", () => {
  test("allows only target lifecycle transitions", () => {
    expect(canTransitionTicketStatus("open", "in_progress")).toBe(true);
    expect(canTransitionTicketStatus("open", "resolved")).toBe(true);
    expect(canTransitionTicketStatus("in_progress", "open")).toBe(true);
    expect(canTransitionTicketStatus("in_progress", "resolved")).toBe(true);
    expect(canTransitionTicketStatus("resolved", "in_progress")).toBe(true);
    expect(canTransitionTicketStatus("resolved", "open")).toBe(true);
    expect(canTransitionTicketStatus("resolved", "closed")).toBe(true);
    expect(canTransitionTicketStatus("closed", "open")).toBe(false);
    expect(canTransitionTicketStatus("open", "closed")).toBe(false);
  });

  test("normalizes legacy waiting status by assignment ownership", () => {
    expect(normalizeTicketStatus("waiting", "staff-1")).toBe("in_progress");
    expect(normalizeTicketStatus("waiting", null)).toBe("open");
  });
});
