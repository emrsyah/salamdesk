"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { TicketDetailData } from "./ticket-detail";
import { RiBookOpenLine, RiDownloadLine, RiFile3Line, RiMessage3Line, RiSparkling2Line } from "@remixicon/react";
import { cn, formatTime } from "@/lib/utils";
import { AttachmentImage } from "./attachment-image";

type MessageAttachment = NonNullable<TicketDetailData["messages"][0]["attachments"]>[0];


interface TicketMessageThreadProps {
  messages: TicketDetailData["messages"];
  ticketId: string;
}



export function TicketMessageThread({ messages, ticketId }: TicketMessageThreadProps) {
  const publicMessages = useMemo(() => messages.filter((m) => !m.isInternalNote), [messages]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Jump to the latest message instantly when a ticket is opened (no animation
  // so the user never sees the thread scroll from the top).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [ticketId]);

  // Keep pinned to the bottom as new messages arrive within the same ticket.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [publicMessages.length]);

  return (
    <div
      ref={scrollRef}
      className="min-h-0 flex-1 overflow-y-auto bg-muted/15 px-4 py-3 sm:px-6"
    >
      <div className="mx-auto max-w-5xl">
        {publicMessages.length === 0 ? (
          <EmptyThread
            icon={<RiMessage3Line className="size-5" />}
            title="Belum ada percakapan"
            description="Balasan publik akan muncul di sini dalam urutan waktu."
          />
        ) : (
          <div className="space-y-4 pb-2">
            {publicMessages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyThread({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-dashed bg-background/70 px-6 py-12 text-center shadow-sm">
      <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}

function MessageBubble({ msg }: { msg: TicketDetailData["messages"][0] }) {
  const isAi = msg.senderType === "ai_agent";
  const isSystem = msg.senderType === "system";
  const isRequester = msg.senderType === "requester";
  const isStaff = msg.senderType === "staff";
  const isOutgoing = isStaff || isAi;
  const senderName = getSenderName(msg);
  const avatarLabel = getAvatarLabel(senderName, msg.senderType);

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="max-w-[78%] rounded-full border bg-background/80 px-3 py-1.5 text-center text-xs text-muted-foreground shadow-sm">
          <span className="font-medium text-foreground/70">Sistem</span>
          <span className="px-1.5">-</span>
          <span>{msg.content}</span>
          <span className="pl-2 text-[10px] uppercase tracking-wide">{formatTime(msg.createdAt)}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex gap-3",
        isOutgoing && !msg.isInternalNote ? "justify-end" : "justify-start",
        msg.pending && "opacity-60",
      )}
    >
      {!isOutgoing || msg.isInternalNote ? (
        <MessageAvatar label={avatarLabel} tone={msg.isInternalNote ? "internal" : "requester"} />
      ) : null}

      <div className={cn("min-w-0 max-w-[82%] sm:max-w-[72%]", isOutgoing && !msg.isInternalNote && "items-end")}>
        <div
          className={cn(
            "mb-1 flex items-center gap-2 text-xs text-muted-foreground",
            isOutgoing && !msg.isInternalNote && "justify-end",
          )}
        >
          <span className="font-medium text-foreground/75">{senderName}</span>
          <span>{msg.pending ? "Mengirim…" : formatTime(msg.createdAt)}</span>
          {isAi ? <MessageTag tone="ai">AI</MessageTag> : null}
          {msg.isInternalNote ? <MessageTag tone="internal">Internal</MessageTag> : null}
        </div>

        <div
          className={cn(
            "whitespace-pre-wrap rounded-2xl border px-4 py-3 text-sm leading-6 shadow-sm",
            isRequester &&
              "rounded-tl-md border-border bg-background text-foreground",
            isStaff &&
              !msg.isInternalNote &&
              "rounded-tr-md border-primary/30 bg-primary text-primary-foreground shadow-primary/10",
            isAi &&
              "rounded-tr-md border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900/70 dark:bg-violet-950/30 dark:text-violet-100",
            msg.isInternalNote &&
              "rounded-tl-md border-yellow-200 bg-yellow-50 text-yellow-950 dark:border-yellow-900/70 dark:bg-yellow-950/25 dark:text-yellow-100",
          )}
        >
          {msg.content.trim() && msg.content}
          {msg.attachments && msg.attachments.length > 0 && (
            <div className={cn("flex flex-col gap-2", msg.content.trim() && "mt-2")}>
              {msg.attachments.map((attachment) => (
                <AttachmentItem key={attachment.id} attachment={attachment} isOutgoing={isOutgoing && !msg.isInternalNote} />
              ))}
            </div>
          )}
        </div>

        {isAi && msg.aiMeta ? <AiReplyMeta meta={msg.aiMeta} /> : null}
      </div>

      {isOutgoing && !msg.isInternalNote ? (
        <MessageAvatar label={avatarLabel} tone={isAi ? "ai" : "staff"} />
      ) : null}
    </div>
  );
}

function AttachmentItem({
  attachment,
  isOutgoing,
}: {
  attachment: MessageAttachment;
  isOutgoing: boolean;
}) {
  const isImage = attachment.mimeType.startsWith("image/");

  if (isImage) {
    return (
      <AttachmentImage
        src={attachment.fileUrl}
        alt={attachment.fileName}
        className="max-h-64 w-auto max-w-full border border-black/10"
      />
    );
  }

  return (
    <a
      href={attachment.fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors",
        isOutgoing
          ? "border-white/20 bg-white/10 hover:bg-white/20"
          : "border-border bg-muted/40 hover:bg-muted",
      )}
    >
      <RiFile3Line className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate font-medium">{attachment.fileName}</span>
      {attachment.fileSize ? (
        <span className="shrink-0 opacity-70">{formatFileSize(attachment.fileSize)}</span>
      ) : null}
      <RiDownloadLine className="size-3.5 shrink-0 opacity-70" />
    </a>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MessageAvatar({
  label,
  tone,
}: {
  label: string;
  tone: "requester" | "staff" | "ai" | "internal";
}) {
  return (
    <div
      className={cn(
        "mt-5 flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold shadow-sm",
        tone === "requester" && "border-border bg-background text-foreground",
        tone === "staff" && "border-primary/30 bg-primary text-primary-foreground",
        tone === "ai" && "border-violet-200 bg-violet-100 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200",
        tone === "internal" && "border-yellow-200 bg-yellow-100 text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200",
      )}
      aria-hidden="true"
    >
      {label}
    </div>
  );
}

function AiReplyMeta({
  meta,
}: {
  meta: NonNullable<TicketDetailData["messages"][0]["aiMeta"]>;
}) {
  const confidencePct =
    meta.replyConfidence != null ? Math.round(meta.replyConfidence * 100) : null;

  return (
    <div className="mt-1 flex flex-wrap items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
      <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 font-medium text-violet-700 dark:border-violet-900/70 dark:bg-violet-950/30 dark:text-violet-200">
        <RiSparkling2Line className="size-3" />
        Balasan otomatis AI
      </span>
      {confidencePct != null ? (
        <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 font-medium text-foreground/70">
          Keyakinan {confidencePct}%
        </span>
      ) : null}
      {meta.kbTitle ? (
        <span className="inline-flex max-w-[14rem] items-center gap-1 truncate rounded-full bg-muted px-1.5 py-0.5 font-medium text-foreground/70">
          <RiBookOpenLine className="size-3 shrink-0" />
          <span className="truncate">{meta.kbTitle}</span>
        </span>
      ) : null}
    </div>
  );
}

function MessageTag({ children, tone }: { children: React.ReactNode; tone: "ai" | "internal" }) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tone === "ai" && "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-200",
        tone === "internal" && "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200",
      )}
    >
      {children}
    </span>
  );
}

function getSenderName(msg: TicketDetailData["messages"][0]) {
  if (msg.senderType === "ai_agent") return "AI Agent";
  if (msg.senderType === "requester") return msg.requester?.displayName ?? "Pelapor";
  if (msg.senderType === "staff") return msg.sender?.name ?? "Staf";
  return "Sistem";
}

function getAvatarLabel(name: string, senderType: TicketDetailData["messages"][0]["senderType"]) {
  if (senderType === "ai_agent") return "AI";

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "?";
}
