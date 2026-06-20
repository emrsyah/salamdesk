"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { mutate } from "swr";
import type { TicketRealtimeEvent } from "@/lib/realtime";
import {
  playNotificationSound,
  primeNotificationSound,
} from "@/lib/notification-sound";

interface TicketEventsValue {
  /** Ticket ids the AI is actively triaging right now (live "menganalisis…"). */
  triagingIds: Set<string>;
  /** Whether new-message sound/desktop alerts are enabled (persisted). */
  soundEnabled: boolean;
  setSoundEnabled: (on: boolean) => void;
}

const TicketEventsContext = createContext<TicketEventsValue>({
  triagingIds: new Set(),
  soundEnabled: false,
  setSoundEnabled: () => {},
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

const SOUND_PREF_KEY = "salamdesk:inbox-sound";

type MessageReceived = Extract<TicketRealtimeEvent, { type: "message:received" }>;

interface TicketEventsProviderProps {
  children: React.ReactNode;
  /** Current staff user id — used to scope new-message alerts. */
  currentUserId: string;
  /** Module ids whose unassigned tickets should alert this user. */
  notifyModuleIds: string[];
  /** owner/admin/supervisor — they get alerts for all unassigned tickets. */
  isPrivileged: boolean;
}

/**
 * Opens a single SSE connection for the tickets workspace and keeps SWR fresh
 * in response to worker/server activity. Also owns new-message alerts (sound +
 * desktop notifications) and the mute preference. The browser auto-reconnects
 * on drop, and the polling intervals in the data hooks remain as a fallback.
 */
export function TicketEventsProvider({
  children,
  currentUserId,
  notifyModuleIds,
  isPrivileged,
}: TicketEventsProviderProps) {
  const [triagingIds, setTriagingIds] = useState<Set<string>>(() => new Set());
  const [soundEnabled, setSoundEnabledState] = useState(false);
  // Per-ticket expiry timers so a missed "completed" can't pin a spinner on.
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Keep latest alert settings in a ref so the once-mounted SSE effect always
  // reads current values without tearing down/recreating the connection.
  const settingsRef = useRef({
    currentUserId,
    notifyModuleIds,
    isPrivileged,
    soundEnabled,
  });
  settingsRef.current = {
    currentUserId,
    notifyModuleIds,
    isPrivileged,
    soundEnabled,
  };

  // Load persisted sound preference once (default: on).
  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem(SOUND_PREF_KEY)
        : null;
    setSoundEnabledState(stored == null ? true : stored === "1");
  }, []);

  const setSoundEnabled = useCallback((on: boolean) => {
    setSoundEnabledState(on);
    try {
      window.localStorage.setItem(SOUND_PREF_KEY, on ? "1" : "0");
    } catch {
      /* localStorage unavailable — ignore */
    }
    if (on) {
      // This runs from a click, so it's a valid gesture to unlock audio and ask
      // for desktop-notification permission.
      primeNotificationSound();
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "default"
      ) {
        void Notification.requestPermission();
      }
    }
  }, []);

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

    const handleMessageReceived = (payload: MessageReceived) => {
      // Always keep the list fresh; the alert decision is separate.
      revalidateTickets();

      const settings = settingsRef.current;
      if (!settings.soundEnabled) return;

      const inScope =
        payload.assigneeId === settings.currentUserId ||
        (payload.assigneeId == null &&
          (settings.isPrivileged ||
            (payload.moduleId != null &&
              settings.notifyModuleIds.includes(payload.moduleId))));
      if (!inScope) return;

      // Don't ping for the ticket you're actively looking at.
      const selected = new URLSearchParams(window.location.search).get(
        "selected",
      );
      if (!document.hidden && selected === payload.ticketId) return;

      playNotificationSound();

      if (
        document.hidden &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        try {
          const notification = new Notification(
            payload.requesterName ?? "Pesan baru",
            {
              body: payload.preview || "Pesan masuk baru",
              tag: `ticket-${payload.ticketId}`,
            },
          );
          notification.onclick = () => {
            window.focus();
            window.location.href = `/app/tickets?selected=${payload.ticketId}`;
          };
        } catch {
          /* Notification construction can throw on some platforms — ignore */
        }
      }
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
        case "message:received":
          handleMessageReceived(payload);
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
    <TicketEventsContext.Provider
      value={{ triagingIds, soundEnabled, setSoundEnabled }}
    >
      {children}
    </TicketEventsContext.Provider>
  );
}
