"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import type { TicketDetailData } from "@/components/tickets/ticket-detail";

async function fetchTicket(url: string): Promise<TicketDetailData | null> {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch ticket");
  return res.json() as Promise<TicketDetailData>;
}

/**
 * Client-side hook for fetching a single ticket's full detail.
 * SWR keeps previously visited tickets in memory so revisits render immediately
 * while the detail revalidates in the background.
 */
export function useTicketDetail(initialTicket?: TicketDetailData | null) {
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("selected");
  const key = selectedId ? `/api/tickets/${selectedId}` : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(key, fetchTicket, {
    fallbackData: initialTicket?.id === selectedId ? initialTicket : undefined,
    keepPreviousData: true,
    // Inbound messages / AI replies are pushed live via SSE (TicketEventsProvider).
    // This slow poll is a fallback for a dropped stream; paused while hidden.
    refreshInterval: 60_000,
  });

  const refetch = useCallback(() => {
    if (selectedId) void mutate();
  }, [mutate, selectedId]);

  return {
    ticket: selectedId ? data : null,
    isLoading,
    isRefreshing: isValidating && Boolean(data),
    error: error ? "Gagal memuat detail tiket." : null,
    selectedId,
    refetch,
  };
}
