"use client";

import { createContext, useContext, useEffect, useState } from "react";
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

/**
 * Opens a single SSE connection for the tickets workspace and keeps SWR fresh
 * in response to worker/server activity. The browser auto-reconnects on drop,
 * and the polling intervals in the data hooks remain as a fallback.
 */
export function TicketEventsProvider({ children }: { children: React.ReactNode }) {
  const [triagingIds, setTriagingIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const source = new EventSource("/api/tickets/stream");

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
          setTriagingIds((prev) => {
            const next = new Set(prev);
            next.add(payload.ticketId);
            return next;
          });
          revalidateTickets();
          break;
        case "triage:completed":
          setTriagingIds((prev) => {
            if (!prev.has(payload.ticketId)) return prev;
            const next = new Set(prev);
            next.delete(payload.ticketId);
            return next;
          });
          revalidateTickets();
          break;
        default:
          // ticket:created / ticket:updated
          revalidateTickets();
      }
    };

    // EventSource reconnects on its own; nothing to do but avoid noisy logs.
    source.onerror = () => {};

    return () => source.close();
  }, []);

  return (
    <TicketEventsContext.Provider value={{ triagingIds }}>
      {children}
    </TicketEventsContext.Provider>
  );
}
