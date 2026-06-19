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

describe("closed tickets are terminal (a closed ticket is never reopened)", () => {
  // A new requester message lands via addRequesterMessageWithLifecycle, which
  // only reopens a *resolved* ticket. For a closed ticket the inbound handler
  // (worker/bot.ts) instead spins up a fresh ticket linked to the closed one.
  // These assertions lock in the state-machine half of that guarantee.
  test("no transition leaves the closed state", () => {
    expect(canTransitionTicketStatus("closed", "open")).toBe(false);
    expect(canTransitionTicketStatus("closed", "in_progress")).toBe(false);
    expect(canTransitionTicketStatus("closed", "resolved")).toBe(false);
    expect(canTransitionTicketStatus("closed", "closed")).toBe(false);
  });

  test("an assigned closed ticket still cannot be reopened", () => {
    // assigneeId must not sneak a closed ticket back into in_progress.
    expect(canTransitionTicketStatus("closed", "in_progress", "staff-1")).toBe(false);
    expect(canTransitionTicketStatus("closed", "open", "staff-1")).toBe(false);
  });

  test("resolved tickets, by contrast, can be reopened or closed", () => {
    expect(canTransitionTicketStatus("resolved", "in_progress")).toBe(true);
    expect(canTransitionTicketStatus("resolved", "open")).toBe(true);
    expect(canTransitionTicketStatus("resolved", "closed")).toBe(true);
  });
});
