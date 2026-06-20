import { redisConnection } from "./redis";

/**
 * Redis pub/sub channel that carries ticket activity to connected browsers.
 *
 * The worker process (ticket creation, AI triage, delayed auto-replies) and the
 * Next.js server (agent-driven mutations) both publish here; the SSE route at
 * `/api/tickets/stream` subscribes and forwards events to the client, which
 * revalidates its SWR caches near-instantly instead of waiting for the poll.
 */
export const TICKET_EVENTS_CHANNEL = "ticket-events";

export type TicketRealtimeEvent =
  | { type: "ticket:created"; ticketId: string }
  | { type: "ticket:updated"; ticketId: string }
  | { type: "triage:started"; ticketId: string }
  | { type: "triage:completed"; ticketId: string; status: string }
  // A new inbound (customer) message. Carries just enough metadata for the
  // client to decide whether to alert (scope: assigned-to-me or unassigned in
  // my modules) without an extra fetch, and to render a desktop notification.
  | {
      type: "message:received";
      ticketId: string;
      moduleId: string | null;
      assigneeId: string | null;
      requesterName: string | null;
      preview: string;
    };

/**
 * Fire-and-forget publish. Realtime is a best-effort enhancement on top of the
 * polling fallback, so a Redis hiccup must never break ticket creation/triage —
 * we log and swallow.
 */
export async function publishTicketEvent(event: TicketRealtimeEvent): Promise<void> {
  try {
    await redisConnection.publish(TICKET_EVENTS_CHANNEL, JSON.stringify(event));
  } catch (err) {
    console.error("[realtime] Failed to publish ticket event:", err);
  }
}
