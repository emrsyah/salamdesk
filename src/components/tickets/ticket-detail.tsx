import { TicketDetailHeader } from "./ticket-detail-header";
import { TicketMessageThread } from "./ticket-message-thread";
import { TicketReplyBox } from "./ticket-reply-box";

export type TicketDetailData = {
  id: string;
  title: string;
  description: string | null;
  status: "open" | "in_progress" | "waiting" | "resolved" | "closed";
  priority: "low" | "medium" | "critical";
  slaStatus: "safe" | "warning" | "breached";
  slaDeadlineAt: Date | string | null;
  source: "whatsapp" | "web" | "email" | "manual";
  createdAt: Date | string;
  module: { id: string; name: string; color: string | null } | null;
  createdBy: { id: string; name: string; email: string } | null;
  assignee: { id: string; name: string } | null;
  messages: {
    id: string;
    content: string;
    senderType: "user" | "ai_bot" | "system";
    isInternalNote: boolean;
    createdAt: Date | string;
    sender: { id: string; name: string } | null;
  }[];
};

interface TicketDetailProps {
  ticket: TicketDetailData | null | undefined;
  quickReplies?: { id: string; label: string; content: string }[];
  engineers?: { id: string; name: string; email: string }[];
  onMutated?: () => void;
}

export function TicketDetail({ ticket, quickReplies, engineers, onMutated }: TicketDetailProps) {
  if (!ticket) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-sm bg-muted/10">
        <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <p className="font-medium">Tidak ada tiket yang dipilih</p>
        <p className="text-xs mt-1">Pilih tiket dari daftar di sebelah kiri untuk melihat detailnya.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      <TicketDetailHeader ticket={ticket} engineers={engineers} onMutated={onMutated} />
      <TicketMessageThread messages={ticket.messages} />
      {ticket.status !== "closed" && ticket.status !== "resolved" && (
        <TicketReplyBox
          ticketId={ticket.id}
          moduleId={ticket.module?.id}
          quickReplies={quickReplies}
          onReplySent={onMutated}
        />
      )}
    </div>
  );
}
