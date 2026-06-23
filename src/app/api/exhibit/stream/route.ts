import IORedis from "ioredis";
import { DASHBOARD_EVENTS_CHANNEL } from "@/lib/dashboard-events";

// Long-lived streaming connection — must run on the Node runtime (ioredis) and
// never be statically cached.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/exhibit/stream — Server-Sent Events for the exhibition live wall.
 *
 * Subscribes a dedicated Redis connection to the dashboard-events channel and
 * forwards each published event to the screen as an SSE `data:` frame. Unlike
 * `/api/tickets/stream`, this is meant to run on an unauthenticated kiosk
 * display, so it does NOT require a staff session. If `EXHIBIT_TOKEN` is set in
 * the environment, callers must pass it as `?token=` — otherwise the stream is
 * open (suitable for a trusted local exhibition network).
 */
export async function GET(request: Request) {
  const expectedToken = process.env.EXHIBIT_TOKEN;
  if (expectedToken) {
    const token = new URL(request.url).searchParams.get("token");
    if (token !== expectedToken) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const encoder = new TextEncoder();
  // A subscriber connection is locked into subscribe mode, so it can't be the
  // shared producer connection — open a dedicated one per stream and close it
  // when the client disconnects.
  const subscriber = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });
  subscriber.on("error", (err) => {
    console.error("[exhibit/stream] Redis subscriber error:", err.message);
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
        if (channel === DASHBOARD_EVENTS_CHANNEL) send(`data: ${message}\n\n`);
      });

      try {
        await subscriber.subscribe(DASHBOARD_EVENTS_CHANNEL);
      } catch (err) {
        console.error("[exhibit/stream] Failed to subscribe:", err);
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
