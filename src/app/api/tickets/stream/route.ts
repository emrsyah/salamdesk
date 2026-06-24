import IORedis from "ioredis";
import { getSession } from "@/lib/auth/session";
import { TICKET_EVENTS_CHANNEL } from "@/lib/realtime";
import { log } from "@/lib/logger";

const xlog = log("api:tickets-stream");

// Long-lived streaming connection — must run on the Node runtime (ioredis) and
// never be statically cached.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/tickets/stream — Server-Sent Events.
 *
 * Subscribes a dedicated Redis connection to the ticket-events channel and
 * forwards each published event to the browser as an SSE `data:` frame. The
 * client (TicketEventsProvider) reacts by revalidating its SWR caches, so new
 * tickets / messages / triage state appear without waiting for the poll.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  // A subscriber connection is locked into subscribe mode, so it can't be the
  // shared producer connection — open a dedicated one per stream and close it
  // when the client disconnects.
  const subscriber = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });
  subscriber.on("error", (err) => {
    xlog.error({ err }, "redis subscriber error");
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;

      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          /* controller already closed */
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        request.signal.removeEventListener("abort", cleanup);
        void subscriber.quit().catch(() => subscriber.disconnect());
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      // Open the stream immediately so the browser's EventSource flips to OPEN.
      send(": connected\n\n");

      // Comment heartbeat keeps intermediaries (and the EventSource) from
      // dropping an idle connection.
      const heartbeat = setInterval(() => send(": ping\n\n"), 25_000);

      subscriber.on("message", (channel, message) => {
        if (channel === TICKET_EVENTS_CHANNEL) send(`data: ${message}\n\n`);
      });

      try {
        await subscriber.subscribe(TICKET_EVENTS_CHANNEL);
      } catch (err) {
        xlog.error({ err }, "failed to subscribe");
        cleanup();
        return;
      }

      if (request.signal.aborted) cleanup();
      else request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable proxy buffering (nginx) so frames flush immediately.
      "X-Accel-Buffering": "no",
    },
  });
}
