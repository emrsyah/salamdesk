"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { mutate } from "swr";
import type { TicketRealtimeEvent } from "@/lib/realtime";

interface TicketEventsValue {
  /** Ticket ids the AI is actively triaging right now (live "menganalisis…"). */
  triagingIds: Set<string>;
}

const TicketEventsContext = createContext<TicketEventsValue>({
  triagingIds: new Set(),
});

export function useTicketEvents() {
  return useContext(TicketEventsContext);
}

/** Revalidate every ticket SWR cache (list + open detail). */
function revalidateTickets() {
  void mutate((key) => typeof key === "string" && key.startsWith("/api/tickets"));
}

// Safety net: if a `triage:completed` event is missed (SSE dropped between
// started and completed), drop the spinner after this long so it can't spin
// forever. The server-derived triageStatus (which ages stale `processing` rows
// out to failed) then becomes the source of truth on the next revalidation.
const TRIAGE_SPINNER_MAX_MS = 3 * 60_000;

/**
 * Opens a single SSE connection for the tickets workspace and keeps SWR fresh
 * in response to worker/server activity. The browser auto-reconnects on drop,
 * and the polling intervals in the data hooks remain as a fallback.
 */
export function TicketEventsProvider({ children }: { children: React.ReactNode }) {
  const [triagingIds, setTriagingIds] = useState<Set<string>>(() => new Set());
  // Per-ticket expiry timers so a missed "completed" can't pin a spinner on.
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = timersRef.current;

    const clearTimer = (ticketId: string) => {
      const timer = timers.get(ticketId);
      if (timer) {
        clearTimeout(timer);
        timers.delete(ticketId);
      }
    };

    const stopTriaging = (ticketId: string) => {
      clearTimer(ticketId);
      setTriagingIds((prev) => {
        if (!prev.has(ticketId)) return prev;
        const next = new Set(prev);
        next.delete(ticketId);
        return next;
      });
    };

    const startTriaging = (ticketId: string) => {
      clearTimer(ticketId);
      timers.set(
        ticketId,
        setTimeout(() => {
          timers.delete(ticketId);
          stopTriaging(ticketId);
          revalidateTickets();
        }, TRIAGE_SPINNER_MAX_MS),
      );
      setTriagingIds((prev) => {
        if (prev.has(ticketId)) return prev;
        const next = new Set(prev);
        next.add(ticketId);
        return next;
      });
    };

    const source = new EventSource("/api/tickets/stream");
    let connectedOnce = false;

    source.onopen = () => {
      // On a *re*connect we may have missed events during the gap (notably a
      // `triage:completed`), so drop any lingering live spinners and resync from
      // the server, which is authoritative.
      if (connectedOnce) {
        timers.forEach((timer) => clearTimeout(timer));
        timers.clear();
        setTriagingIds((prev) => (prev.size === 0 ? prev : new Set()));
        revalidateTickets();
      }
      connectedOnce = true;
    };

    source.onmessage = (event) => {
      let payload: TicketRealtimeEvent;
      try {
        payload = JSON.parse(event.data) as TicketRealtimeEvent;
      } catch {
        return;
      }
      if (!payload?.type) return;

      switch (payload.type) {
        case "triage:started":
          startTriaging(payload.ticketId);
          revalidateTickets();
          break;
        case "triage:completed":
          stopTriaging(payload.ticketId);
          revalidateTickets();
          break;
        default:
          // ticket:created / ticket:updated
          revalidateTickets();
      }
    };

    // EventSource reconnects on its own; nothing to do but avoid noisy logs.
    source.onerror = () => {};

    return () => {
      source.close();
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  return (
    <TicketEventsContext.Provider value={{ triagingIds }}>
      {children}
    </TicketEventsContext.Provider>
  );
}
