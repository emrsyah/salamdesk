import { RiInboxLine, RiUserLine, RiCheckLine } from "@remixicon/react";
import { TicketSLABadge } from "./ticket-sla-badge";

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

const STATUS_LABEL: Record<TicketDetailData["status"], string> = {
  open: "Terbuka",
  in_progress: "Sedang Dikerjakan",
  waiting: "Menunggu",
  resolved: "Selesai",
  closed: "Ditutup",
};

const STATUS_STYLE: Record<TicketDetailData["status"], string> = {
  open: "bg-blue-50 text-blue-700 border-blue-200/50",
  in_progress: "bg-purple-50 text-purple-700 border-purple-200/50",
  waiting: "bg-orange-50 text-orange-700 border-orange-200/50",
  resolved: "bg-green-50 text-green-700 border-green-200/50",
  closed: "bg-gray-50 text-gray-600 border-gray-200/50",
};

const PRIORITY_LABEL: Record<TicketDetailData["priority"], string> = {
  low: "Rendah",
  medium: "Sedang",
  critical: "Kritis",
};

const PRIORITY_STYLE: Record<TicketDetailData["priority"], string> = {
  low: "text-blue-600 bg-blue-50 border-blue-200/50",
  medium: "text-orange-600 bg-orange-50 border-orange-200/50",
  critical: "text-red-600 bg-red-50 border-red-200/50",
};

const SOURCE_LABEL: Record<TicketDetailData["source"], string> = {
  whatsapp: "WhatsApp",
  web: "Web",
  email: "Email",
  manual: "Manual",
};

function formatTime(date: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

interface TicketDetailProps {
  ticket: TicketDetailData | null | undefined;
}

export function TicketDetail({ ticket }: TicketDetailProps) {
  if (!ticket) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Pilih tiket untuk melihat detail.
      </div>
    );
  }

  const shortId = `#${ticket.id.slice(0, 8).toUpperCase()}`;

  return (
    <div className="flex-1 overflow-y-auto bg-background h-full flex flex-col">
      {/* Sticky header */}
      <div className="sticky top-0 bg-background border-b z-10 p-6 pb-4">
        <div className="max-w-4xl mx-auto flex justify-between items-start gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <span className="font-medium text-foreground/70">{shortId}</span>
              <span>•</span>
              <span>{ticket.module?.name ?? "Tidak ada modul"}</span>
              <span>•</span>
              <span>{formatTime(ticket.createdAt)}</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">{ticket.title}</h2>
            <div className="flex items-center gap-2 pt-3 text-xs flex-wrap">
              <span
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium border ${STATUS_STYLE[ticket.status]}`}
              >
                <span className="size-1.5 rounded-full bg-current opacity-60 inline-block" />
                {STATUS_LABEL[ticket.status]}
              </span>
              <span className={`font-medium px-2 py-1 rounded border ${PRIORITY_STYLE[ticket.priority]}`}>
                {PRIORITY_LABEL[ticket.priority]}
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <RiInboxLine className="size-3.5" />
                {SOURCE_LABEL[ticket.source]}
              </span>
              {ticket.createdBy && (
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <RiUserLine className="size-3.5" />
                  {ticket.createdBy.name}
                </span>
              )}
              <TicketSLABadge
                slaDeadlineAt={ticket.slaDeadlineAt}
                slaStatus={ticket.slaStatus}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              disabled
              title="Tersedia di Phase 2"
              className="flex items-center justify-center size-9 rounded-md border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
            >
              <RiUserLine className="size-4" />
            </button>
            <button
              disabled
              title="Tersedia di Phase 3"
              className="px-3 py-2 text-sm border rounded-md hover:bg-muted font-medium transition-colors disabled:opacity-40"
            >
              Eskalasi
            </button>
            <button
              disabled
              title="Tersedia di Phase 3"
              className="px-3 py-2 text-sm bg-yellow-400 text-yellow-950 rounded-md hover:bg-yellow-500 font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40"
            >
              <RiCheckLine className="size-4" /> Selesai
            </button>
          </div>
        </div>
      </div>

      {/* Message thread */}
      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {ticket.messages.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              Belum ada pesan.
            </div>
          ) : (
            ticket.messages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-lg border p-4 ${
                  msg.isInternalNote
                    ? "bg-yellow-50/30 border-yellow-200 dark:bg-yellow-950/20"
                    : "bg-background"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    {msg.senderType === "ai_bot"
                      ? "AI Bot"
                      : msg.senderType === "system"
                        ? "Sistem"
                        : (msg.sender?.name ?? "Anonim")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                {msg.isInternalNote && (
                  <span className="text-xs text-yellow-600 font-medium mt-2 block">
                    Catatan Internal
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
