"use client";

import dynamic from "next/dynamic";
import { useTickets } from "@/hooks/use-tickets";
import { useTicketDetail } from "@/hooks/use-ticket-detail";
import { TicketList } from "@/components/tickets/ticket-list";
import {
  TicketDetail,
  type TicketDetailData,
} from "@/components/tickets/ticket-detail";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { loadStoredTicketConfiguration } from "@/lib/tickets/ticket-configuration-storage";
import type { TicketConfiguration } from "@/lib/tickets/ticket-configuration";
import type { TicketListEntry } from "@/components/tickets/ticket-list-item";

const TicketConfigurationSheet = dynamic(
  () =>
    import("@/components/tickets/ticket-configuration-sheet").then(
      (mod) => mod.TicketConfigurationSheet,
    ),
  { ssr: false },
);

type Module = { id: string; name: string; color: string | null; slug: string };
type QuickReply = { id: string; label: string; content: string };
type AssignableStaff = { id: string; name: string; email: string; role: string };

interface TicketInboxProps {
  modules: Module[];
  quickReplies: QuickReply[];
  assignableStaff: AssignableStaff[];
  initialTickets: TicketListEntry[];
  initialTicket: TicketDetailData | null;
  defaultConfiguration: TicketConfiguration;
}

function TicketListSkeleton() {
  return (
    <div className="flex w-80 md:w-96 flex-col border-r shrink-0 h-full bg-background">
      <div className="flex items-center justify-between p-4 pb-2">
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
      <div className="px-4 pb-3">
        <Skeleton className="h-9 w-full rounded-md" />
      </div>
      <div className="px-4 border-b pb-3 flex gap-4">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-12" />
      </div>
      <div className="flex-1 overflow-y-auto space-y-px pt-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="p-4 border-b space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <div className="flex justify-between pt-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TicketDetailSkeleton() {
  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      <div className="border-b p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      </div>
      <div className="flex-1 p-6 space-y-4 overflow-y-auto">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`flex gap-3 ${i % 2 === 0 ? "" : "flex-row-reverse"}`}>
            <Skeleton className="size-8 rounded-full shrink-0" />
            <Skeleton className={`h-16 rounded-lg ${i % 2 === 0 ? "w-2/3" : "w-1/2"}`} />
          </div>
        ))}
      </div>
      <div className="border-t p-4">
        <Skeleton className="h-20 w-full rounded-md" />
      </div>
    </div>
  );
}

export function TicketInbox({
  modules,
  quickReplies,
  assignableStaff,
  initialTickets,
  initialTicket,
  defaultConfiguration,
}: TicketInboxProps) {
  const { tickets, isLoading: ticketsLoading, refetch: refetchTickets } =
    useTickets(initialTickets);
  const {
    ticket,
    isLoading: detailLoading,
    selectedId,
    refetch: refetchDetail,
  } = useTicketDetail(initialTicket);
  const [configuration, setConfiguration] = useState<TicketConfiguration>(defaultConfiguration);
  const [configurationHydrated, setConfigurationHydrated] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setConfiguration(loadStoredTicketConfiguration(modules));
      setConfigurationHydrated(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [modules]);

  // Called after any mutation (create, status change, assign) to refresh both lists
  const handleMutated = () => {
    refetchTickets();
    refetchDetail();
  };

  return (
    <div className="flex min-h-0 h-full w-full bg-background overflow-hidden">
      {ticketsLoading ? (
        <TicketListSkeleton />
      ) : (
        <TicketList
          tickets={tickets}
          modules={modules}
          configuration={configuration}
          configurationControl={configurationHydrated ? (
            <TicketConfigurationSheet
              modules={modules}
              value={configuration}
              onChange={setConfiguration}
            />
          ) : null}
          onTicketCreated={refetchTickets}
        />
      )}

      {selectedId ? (
        detailLoading ? (
          <TicketDetailSkeleton />
        ) : (
          <TicketDetail
            ticket={ticket}
            quickReplies={quickReplies}
            assignableStaff={assignableStaff}
            modules={modules}
            configuration={configuration}
            onMutated={handleMutated}
          />
        )
      ) : (
        <TicketDetail
          ticket={null}
          quickReplies={quickReplies}
          assignableStaff={assignableStaff}
          modules={modules}
          configuration={configuration}
        />
      )}
    </div>
  );
}
