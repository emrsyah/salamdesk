"use client";

import { useTickets } from "@/hooks/use-tickets";
import { useTicketDetail } from "@/hooks/use-ticket-detail";
import { TicketList } from "@/components/tickets/ticket-list";
import { TicketDetail } from "@/components/tickets/ticket-detail";
import { Skeleton } from "@/components/ui/skeleton";

type Module = { id: string; name: string; color: string | null; slug: string };
type QuickReply = { id: string; label: string; content: string };
type AssignableStaff = { id: string; name: string; email: string; role: string };

interface TicketInboxProps {
  modules: Module[];
  quickReplies: QuickReply[];
  assignableStaff: AssignableStaff[];
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

export function TicketInbox({ modules, quickReplies, assignableStaff }: TicketInboxProps) {
  const { tickets, isLoading: ticketsLoading, refetch: refetchTickets } = useTickets();
  const { ticket, isLoading: detailLoading, selectedId, refetch: refetchDetail } = useTicketDetail();

  // Called after any mutation (create, status change, assign) to refresh both lists
  const handleMutated = () => {
    refetchTickets();
    refetchDetail();
  };

  return (
    <div className="flex h-full w-full bg-background overflow-hidden">
      {ticketsLoading ? (
        <TicketListSkeleton />
      ) : (
        <TicketList tickets={tickets as any} modules={modules} onTicketCreated={refetchTickets} />
      )}

      {selectedId ? (
        detailLoading ? (
          <TicketDetailSkeleton />
        ) : (
          <TicketDetail
            ticket={ticket as any}
            quickReplies={quickReplies as any}
            assignableStaff={assignableStaff as any}
            onMutated={handleMutated}
          />
        )
      ) : (
        <TicketDetail
          ticket={null}
          quickReplies={quickReplies as any}
          assignableStaff={assignableStaff as any}
        />
      )}
    </div>
  );
}
