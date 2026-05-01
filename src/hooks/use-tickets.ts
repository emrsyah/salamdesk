"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import type { TicketListEntry } from "@/components/tickets/ticket-list-item";

/**
 * Client-side hook for fetching tickets.
 * Watches searchParams so any filter change (module, priority, assignee, etc.)
 * triggers a re-fetch WITHOUT a full page re-render.
 */
export function useTickets() {
  const searchParams = useSearchParams();
  const [tickets, setTickets] = useState<TicketListEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // Build query string from current search params, excluding UI-only params
    const params = new URLSearchParams();
    const filterKeys = ["assignee", "priority", "sla", "module", "status", "resolvedBy"];
    for (const key of filterKeys) {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    }

    try {
      const res = await fetch(`/api/tickets?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch tickets");
      const data = await res.json();
      setTickets(data);
    } catch (err) {
      console.error("useTickets fetch error:", err);
      setError("Gagal memuat tiket.");
    } finally {
      setIsLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  return { tickets, isLoading, error, refetch: fetchTickets };
}
