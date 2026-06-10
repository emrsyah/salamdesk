"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import type { TicketListEntry } from "@/components/tickets/ticket-list-item";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch tickets");
  return res.json() as Promise<T>;
}

/**
 * Client-side hook for fetching tickets.
 * Watches only ticket filters so UI-only params like `selected` do not reload
 * the list when the user moves between ticket details.
 */
export function useTickets(initialTickets?: TicketListEntry[]) {
  const searchParams = useSearchParams();

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    const filterKeys = ["assignee", "priority", "sla", "module", "status", "resolvedBy"];
    for (const key of filterKeys) {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    }
    return params.toString();
  }, [searchParams]);

  const key = queryString ? `/api/tickets?${queryString}` : "/api/tickets";
  const [initialKey] = useState(key);
  const { data, error, isLoading, isValidating, mutate } = useSWR<
    TicketListEntry[]
  >(key, fetchJson, {
    fallbackData: key === initialKey ? initialTickets : undefined,
    keepPreviousData: true,
    // New tickets/reopens arrive from the worker process — poll for them.
    refreshInterval: 30_000,
  });

  const refetch = useCallback(() => {
    void mutate();
  }, [mutate]);

  return {
    tickets: data ?? [],
    isLoading,
    isRefreshing: isValidating && Boolean(data),
    error: error ? "Gagal memuat tiket." : null,
    refetch,
  };
}
