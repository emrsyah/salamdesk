"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { DashboardEvent } from "@/lib/dashboard-events.types";

/** Max events retained in memory — bounds the wall over a multi-hour exhibition. */
const FEED_CAPACITY = 80;
/** How many active-ticket pipelines to show in the center theater at once. */
const PIPELINE_CAPACITY = 4;
/** Rolling window (ms) for the tickets/min metric. */
const RATE_WINDOW_MS = 60_000;

/** One ticket's in-flight reasoning, assembled from its stream of events. */
export interface PipelineState {
  ticketId: string;
  requesterName: string | null;
  preview: string;
  /** Most recent event timestamp — drives ordering + eviction. */
  lastTs: number;
  steps: DashboardEvent[];
  /** True once a `reply.sent` arrives — card can animate out shortly after. */
  done: boolean;
  /** Came in via the exhibition QR prefill. */
  boothVisitor: boolean;
}

export interface ExhibitMetrics {
  /** Tickets opened in the last RATE_WINDOW_MS. */
  ticketsPerMin: number;
  /** Module name → count, this session. */
  moduleCounts: Record<string, number>;
  /** Priority → count, this session. */
  priorityCounts: Record<string, number>;
  autoReplied: number;
  drafted: number;
  kbHits: number;
  kbSearches: number;
  offTopicBlocked: number;
  toolCalls: number;
}

interface ExhibitStreamValue {
  connected: boolean;
  feed: DashboardEvent[];
  pipelines: PipelineState[];
  metrics: ExhibitMetrics;
  /** Kiosk token (if configured), so links can carry it to gated routes. */
  token?: string;
}

const EMPTY_METRICS: ExhibitMetrics = {
  ticketsPerMin: 0,
  moduleCounts: {},
  priorityCounts: {},
  autoReplied: 0,
  drafted: 0,
  kbHits: 0,
  kbSearches: 0,
  offTopicBlocked: 0,
  toolCalls: 0,
};

const ExhibitStreamContext = createContext<ExhibitStreamValue>({
  connected: false,
  feed: [],
  pipelines: [],
  metrics: EMPTY_METRICS,
});

export function useExhibitStream() {
  return useContext(ExhibitStreamContext);
}

/**
 * Opens a single SSE connection to `/api/exhibit/stream` and projects the raw
 * event stream into three derived views the wall renders: a bounded feed, the
 * per-ticket pipeline cards, and aggregate metrics. The stream IS the data — no
 * SWR/polling. The browser's EventSource auto-reconnects on drop.
 */
export function ExhibitStreamProvider({
  token,
  children,
}: {
  /** Optional kiosk token, appended as `?token=` when EXHIBIT_TOKEN is set. */
  token?: string;
  children: React.ReactNode;
}) {
  const [connected, setConnected] = useState(false);
  const [feed, setFeed] = useState<DashboardEvent[]>([]);
  const [pipelines, setPipelines] = useState<Map<string, PipelineState>>(
    () => new Map(),
  );
  const [metrics, setMetrics] = useState<ExhibitMetrics>(EMPTY_METRICS);

  // Sliding window of recent ticket-open timestamps for the tickets/min gauge.
  const ticketTimesRef = useRef<number[]>([]);

  useEffect(() => {
    const url = token
      ? `/api/exhibit/stream?token=${encodeURIComponent(token)}`
      : "/api/exhibit/stream";
    const source = new EventSource(url);

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);

    source.onmessage = (event) => {
      let e: DashboardEvent;
      try {
        e = JSON.parse(event.data) as DashboardEvent;
      } catch {
        return;
      }
      if (!e?.type) return;

      // 1. Feed — newest first, capped.
      setFeed((prev) => [e, ...prev].slice(0, FEED_CAPACITY));

      // 2. Pipelines — group ticket events into a per-ticket reasoning card.
      if (e.ticketId) {
        const ticketId = e.ticketId;
        setPipelines((prev) => {
          const next = new Map(prev);
          const existing = next.get(ticketId);
          const base: PipelineState =
            existing ??
            {
              ticketId,
              requesterName:
                e.type === "ticket.new" ? e.requesterName : null,
              preview: e.type === "ticket.new" ? e.preview : "",
              lastTs: e.ts,
              steps: [],
              done: false,
              boothVisitor:
                e.type === "ticket.new" ? e.boothVisitor === true : false,
            };
          next.set(ticketId, {
            ...base,
            requesterName:
              e.type === "ticket.new" ? e.requesterName : base.requesterName,
            preview: e.type === "ticket.new" ? e.preview : base.preview,
            boothVisitor:
              e.type === "ticket.new" ? e.boothVisitor === true : base.boothVisitor,
            lastTs: e.ts,
            steps: [...base.steps, e],
            done: base.done || e.type === "reply.sent",
          });

          // Keep only the most recently active N pipelines.
          if (next.size > PIPELINE_CAPACITY) {
            const oldest = [...next.values()]
              .sort((a, b) => a.lastTs - b.lastTs)
              .slice(0, next.size - PIPELINE_CAPACITY);
            for (const p of oldest) next.delete(p.ticketId);
          }
          return next;
        });
      }

      // 3. Metrics — fold each event into the running aggregates.
      setMetrics((m) => {
        const next = { ...m };
        switch (e.type) {
          case "ticket.new": {
            ticketTimesRef.current.push(e.ts);
            break;
          }
          case "classify.module": {
            if (e.moduleName) {
              next.moduleCounts = {
                ...next.moduleCounts,
                [e.moduleName]: (next.moduleCounts[e.moduleName] ?? 0) + 1,
              };
            }
            break;
          }
          case "classify.priority": {
            next.priorityCounts = {
              ...next.priorityCounts,
              [e.priority]: (next.priorityCounts[e.priority] ?? 0) + 1,
            };
            break;
          }
          case "guard.offtopic": {
            if (!e.onTopic) next.offTopicBlocked = m.offTopicBlocked + 1;
            break;
          }
          case "kb.searched": {
            next.kbSearches = m.kbSearches + 1;
            break;
          }
          case "kb.matched": {
            next.kbHits = m.kbHits + 1;
            break;
          }
          case "tool.invoked": {
            next.toolCalls = m.toolCalls + 1;
            break;
          }
          case "reply.sent": {
            if (e.mode === "draft") next.drafted = m.drafted + 1;
            else next.autoReplied = m.autoReplied + 1;
            break;
          }
        }
        return next;
      });
    };

    return () => source.close();
  }, [token]);

  // Recompute tickets/min on a timer so the rolling window decays even when no
  // new events arrive (otherwise the gauge would freeze between tickets).
  useEffect(() => {
    const tick = () => {
      const cutoff = Date.now() - RATE_WINDOW_MS;
      ticketTimesRef.current = ticketTimesRef.current.filter((t) => t >= cutoff);
      setMetrics((m) =>
        m.ticketsPerMin === ticketTimesRef.current.length
          ? m
          : { ...m, ticketsPerMin: ticketTimesRef.current.length },
      );
    };
    const id = setInterval(tick, 2_000);
    return () => clearInterval(id);
  }, []);

  const pipelineList = useMemo(
    () => [...pipelines.values()].sort((a, b) => b.lastTs - a.lastTs),
    [pipelines],
  );

  const value = useMemo<ExhibitStreamValue>(
    () => ({ connected, feed, pipelines: pipelineList, metrics, token }),
    [connected, feed, pipelineList, metrics, token],
  );

  return (
    <ExhibitStreamContext.Provider value={value}>
      {children}
    </ExhibitStreamContext.Provider>
  );
}
