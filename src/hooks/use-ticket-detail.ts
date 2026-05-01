"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import type { TicketDetailData } from "@/components/tickets/ticket-detail";

/**
 * Client-side hook for fetching a single ticket's full detail.
 * Watches the `selected` searchParam so switching tickets
 * only fetches the new detail — no full page re-render.
 */
export function useTicketDetail() {
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("selected");

  const [ticket, setTicket] = useState<TicketDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTicket = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tickets/${id}`);
      if (res.status === 404) {
        setTicket(null);
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch ticket");
      const data = await res.json();
      setTicket(data);
    } catch (err) {
      console.error("useTicketDetail fetch error:", err);
      setError("Gagal memuat detail tiket.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      fetchTicket(selectedId);
    } else {
      setTicket(null);
    }
  }, [selectedId, fetchTicket]);

  return { ticket, isLoading, error, selectedId, refetch: () => { if (selectedId) fetchTicket(selectedId); } };
}
