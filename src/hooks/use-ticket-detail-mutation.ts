"use client";

import { useCallback } from "react";
import { useSWRConfig } from "swr";
import type { TicketDetailData } from "@/components/tickets/ticket-detail";

/**
 * Optimistic mutations against the ticket-detail SWR cache.
 *
 * `optimisticUpdate(apply, action)`:
 *   1. Immediately writes `apply(current)` to the `/api/tickets/<id>` cache.
 *   2. Runs the server `action`.
 *   3. On failure: SWR rolls the cache back to the pre-mutation value and the
 *      error is rethrown so the caller can toast / restore form state.
 *   4. On success (and failure): revalidates against the server so the cache
 *      converges on the real row (server-generated ids, timestamps, etc.).
 *
 * Components only know the ticket id — the cache key is shared with
 * `useTicketDetail`, so no prop drilling of `mutate` is needed.
 */
export function useTicketDetailMutation(ticketId: string) {
  const { mutate } = useSWRConfig();

  const optimisticUpdate = useCallback(
    async (
      apply: (current: TicketDetailData) => TicketDetailData,
      action: () => Promise<unknown>,
    ) => {
      await mutate(
        `/api/tickets/${ticketId}`,
        async (current?: TicketDetailData | null) => {
          await action();
          // Keep the optimistic shape until revalidation replaces it; the
          // action result is not the full ticket payload.
          return current ?? undefined;
        },
        {
          optimisticData: (current?: TicketDetailData | null) =>
            current ? apply(current) : (current as unknown as TicketDetailData),
          rollbackOnError: true,
          populateCache: false,
          revalidate: true,
        },
      );
    },
    [mutate, ticketId],
  );

  return { optimisticUpdate };
}
