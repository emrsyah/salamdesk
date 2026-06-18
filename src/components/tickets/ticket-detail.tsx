"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useQueryParams } from "@/hooks/use-query-params";
import type { TicketConfiguration } from "@/lib/tickets/ticket-configuration";
import type { AiSuggestionData } from "./ticket-ai-suggestion";
import { TicketDetailHeader } from "./ticket-detail-header";
import { TicketMessageThread } from "./ticket-message-thread";

const RequesterSidePanel = dynamic(
  () => import("./requester-side-panel").then((mod) => mod.RequesterSidePanel),
  { ssr: false },
);
const TicketAiCopilotPanel = dynamic(
  () => import("./ticket-ai-copilot-panel").then((mod) => mod.TicketAiCopilotPanel),
  { ssr: false },
);
const TicketAiSuggestion = dynamic(
  () => import("./ticket-ai-suggestion").then((mod) => mod.TicketAiSuggestion),
  { ssr: false },
);
const TicketReplyBox = dynamic(
  () => import("./ticket-reply-box").then((mod) => mod.TicketReplyBox),
  { ssr: false },
);

type ModuleOption = { id: string; name: string; color: string | null; slug?: string };

export type TicketDetailData = {
  id: string;
  title: string;
  description: string | null;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "critical";
  slaStatus: "safe" | "warning" | "breached";
  slaDeadlineAt: Date | string | null;
  firstResponseSlaStatus?: "safe" | "warning" | "breached";
  firstResponseDueAt?: Date | string | null;
  firstRespondedAt?: Date | string | null;
  resolutionSlaStatus?: "safe" | "warning" | "breached";
  resolutionDueAt?: Date | string | null;
  resolvedAt?: Date | string | null;
  source: "whatsapp" | "web" | "email" | "manual" | "api";
  createdAt: Date | string;
  requester: {
    id: string;
    displayName: string;
    fullName: string | null;
    jobTitle?: string | null;
    employeeNumber?: string | null;
    primaryPhone: string | null;
    primaryEmail: string | null;
    externalRef?: string | null;
    notes?: string | null;
    department: { id: string; name: string } | null;
  } | null;
  module: { id: string; name: string; color: string | null } | null;
  createdBy: { id: string; name: string; email: string } | null;
  assignee: { id: string; name: string } | null;
  messages: {
    id: string;
    content: string;
    senderType: "requester" | "staff" | "ai_agent" | "system";
    isInternalNote: boolean;
    createdAt: Date | string;
    /** Client-only: message shown optimistically while the send is in flight. */
    pending?: boolean;
    sender: { id: string; name: string } | null;
    requester: { id: string; displayName: string } | null;
    /** Present on AI-sent messages: why the AI replied (confidence + KB used). */
    aiMeta?: {
      replyConfidence: number | null;
      kbId: string | null;
      kbTitle: string | null;
    } | null;
    attachments?: {
      id: string;
      fileName: string;
      fileUrl: string;
      mimeType: string;
      fileSize: number | null;
    }[];
  }[];
  aiSuggestions?: AiSuggestionData[];
};

// Stable empty-array default so an omitted prop keeps the same reference
// across renders instead of allocating a fresh array each time.
const EMPTY_ARRAY: never[] = [];

interface TicketDetailProps {
  ticket: TicketDetailData | null | undefined;
  quickReplies?: { id: string; label: string; content: string }[];
  assignableStaff?: { id: string; name: string; email: string; role: string }[];
  modules?: ModuleOption[];
  configuration?: TicketConfiguration;
  onMutated?: () => void;
}

export function TicketDetail({
  ticket,
  quickReplies,
  assignableStaff,
  modules = EMPTY_ARRAY,
  configuration,
  onMutated,
}: TicketDetailProps) {
  const [activePanel, setActivePanel] = useState<"requester" | "copilot" | null>(null);
  // Reply draft is lifted here so the copilot can inject a grounded draft into
  // the (still editable) reply box. `nonce` lets the box react to repeat inserts.
  const [replyDraft, setReplyDraft] = useState<{ text: string; nonce: number }>({
    text: "",
    nonce: 0,
  });
  const [autoDraftNonce, setAutoDraftNonce] = useState(0);
  const { setQueryParam } = useQueryParams();

  function togglePanel(panel: "requester" | "copilot") {
    setActivePanel((current) => (current === panel ? null : panel));
  }

  function insertDraft(text: string) {
    setReplyDraft((prev) => ({ text, nonce: prev.nonce + 1 }));
  }

  function requestDraft() {
    setActivePanel("copilot");
    setAutoDraftNonce((value) => value + 1);
  }

  if (!ticket) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-muted/10 text-sm text-muted-foreground">
        <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
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
        <p className="mt-1 text-xs">Pilih tiket dari daftar di sebelah kiri untuk melihat detailnya.</p>
      </div>
    );
  }

  const latestSuggestion = ticket.aiSuggestions?.[0] ?? null;
  // Show the most recent AI auto-reply (messages are ascending by time), so the
  // panel tracks the latest follow-up rather than the first reply on the ticket.
  const aiReplyMessage = latestSuggestion
    ? [...ticket.messages]
        .reverse()
        .find((message) => message.senderType === "ai_agent" && !message.isInternalNote)
    : null;
  const internalNotes = ticket.messages.filter((message) => message.isInternalNote);

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-background">
      <TicketDetailHeader
        ticket={ticket}
        modules={modules}
        configuration={configuration}
        assignableStaff={assignableStaff}
        isRequesterPanelOpen={activePanel === "requester"}
        onToggleRequesterPanel={() => togglePanel("requester")}
        isCopilotOpen={activePanel === "copilot"}
        onToggleCopilot={() => togglePanel("copilot")}
        onMutated={onMutated}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <TicketMessageThread messages={ticket.messages} />
          {latestSuggestion && (
            <TicketAiSuggestion
              key={latestSuggestion.id}
              suggestion={latestSuggestion}
              aiReply={aiReplyMessage?.content ?? null}
              onFeedback={onMutated}
            />
          )}
          {ticket.status !== "closed" && ticket.status !== "resolved" && (
            <TicketReplyBox
              ticketId={ticket.id}
              moduleId={ticket.module?.id}
              quickReplies={quickReplies}
              internalNotes={internalNotes}
              draftInsert={replyDraft}
              onRequestDraft={requestDraft}
              onReplySent={onMutated}
            />
          )}
        </div>
        {activePanel === "requester" && (
          <RequesterSidePanel
            key={ticket.requester?.id ?? ticket.id}
            requester={ticket.requester}
            currentTicketId={ticket.id}
            onClose={() => setActivePanel(null)}
            onRequesterUpdated={onMutated}
            onSelectTicket={(ticketId) => setQueryParam("selected", ticketId, { replace: true })}
          />
        )}
        {activePanel === "copilot" && (
          <TicketAiCopilotPanel
            key={`copilot-${ticket.id}`}
            ticket={ticket}
            autoDraftNonce={autoDraftNonce}
            onUseDraft={insertDraft}
            onClose={() => setActivePanel(null)}
          />
        )}
      </div>
    </div>
  );
}
