"use client";

import { useEffect, useRef, useState } from "react";
import {
  RiArrowDownSLine,
  RiAttachment2,
  RiChatQuoteLine,
  RiCloseLine,
  RiFile3Line,
  RiLockLine,
  RiSendPlane2Line,
  RiSparklingLine,
} from "@remixicon/react";
import { useUploadThing } from "@/lib/uploadthing";
import { AttachmentImage } from "./attachment-image";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatTime } from "@/lib/utils";
import type { TicketDetailData } from "./ticket-detail";

type PendingAttachment = {
  fileName: string;
  fileUrl: string;
  storageKey: string;
  mimeType: string;
  fileSize: number;
};

interface TicketReplyBoxProps {
  ticketId: string;
  moduleId?: string | null;
  quickReplies?: { id: string; label: string; content: string }[];
  internalNotes?: TicketDetailData["messages"];
  /** A copilot-generated draft to drop into the editable reply field. */
  draftInsert?: { text: string; nonce: number };
  /** Opens the copilot and asks it to auto-draft from the best KB match. */
  onRequestDraft?: () => void;
  onReplySent?: () => void;
}

export function TicketReplyBox({
  ticketId,
  quickReplies = [],
  internalNotes = [],
  draftInsert,
  onRequestDraft,
  onReplySent,
}: TicketReplyBoxProps) {
  const [content, setContent] = useState("");

  // Apply a copilot draft when its nonce changes (a fresh insert request).
  useEffect(() => {
    if (draftInsert && draftInsert.nonce > 0) {
      setContent(draftInsert.text);
    }
  }, [draftInsert?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const [internalContent, setInternalContent] = useState("");
  const [isInternalPanelOpen, setIsInternalPanelOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInternalLoading, setIsInternalLoading] = useState(false);

  // Files already uploaded to uploadthing, waiting to be attached on send.
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { startUpload, isUploading } = useUploadThing("ticketAttachmentUploader", {
    onClientUploadComplete: (results) => {
      setAttachments((prev) => [
        ...prev,
        ...results.map((file) => ({
          fileName: file.serverData.name,
          fileUrl: file.serverData.url,
          storageKey: file.serverData.key,
          mimeType: file.serverData.type,
          fileSize: file.serverData.size,
        })),
      ]);
    },
    onUploadError: (error) => {
      console.error(error);
    },
  });

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    void startUpload(Array.from(fileList));
    // Reset so selecting the same file again re-triggers onChange.
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeAttachment(storageKey: string) {
    setAttachments((prev) => prev.filter((a) => a.storageKey !== storageKey));
  }

  async function handleSubmit() {
    const hasText = content.trim().length > 0;
    if ((!hasText && attachments.length === 0) || isLoading || isUploading) return;

    setIsLoading(true);
    try {
      const { sendReplyAction } = await import("@/actions/messages.actions");
      await sendReplyAction({
        ticketId,
        content,
        isInternalNote: false,
        attachments: attachments.map(({ fileName, fileUrl, storageKey, mimeType, fileSize }) => ({
          fileName,
          fileUrl,
          storageKey,
          mimeType,
          fileSize,
        })),
      });
      setContent("");
      setAttachments([]);
      onReplySent?.();
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleInternalSubmit() {
    if (!internalContent.trim() || isInternalLoading) return;

    setIsInternalLoading(true);
    try {
      const { sendReplyAction } = await import("@/actions/messages.actions");
      await sendReplyAction({
        ticketId,
        content: internalContent,
        isInternalNote: true,
      });
      setInternalContent("");
      setIsInternalPanelOpen(true);
      onReplySent?.();
    } catch (error) {
      console.error(error);
    } finally {
      setIsInternalLoading(false);
    }
  }

  return (
    <div className="border-t bg-background px-6 py-4">
      <div className="mx-auto max-w-5xl">
        {isInternalPanelOpen && (
          <div className="mb-3 rounded-lg border border-yellow-200 bg-yellow-50/45 p-3 dark:border-yellow-900/70 dark:bg-yellow-950/20">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <RiLockLine className="size-4 shrink-0 text-yellow-700 dark:text-yellow-300" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-yellow-950 dark:text-yellow-100">
                    Catatan Internal
                  </p>
                  <p className="text-xs text-yellow-800/80 dark:text-yellow-200/80">
                    Hanya terlihat oleh tim.
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-xs text-yellow-900 hover:bg-yellow-100 dark:text-yellow-100 dark:hover:bg-yellow-950"
                onClick={() => setIsInternalPanelOpen(false)}
              >
                Tutup
              </Button>
            </div>

            <div className="max-h-36 space-y-2 overflow-y-auto pr-1">
              {internalNotes.length === 0 ? (
                <div className="rounded-md border border-dashed border-yellow-200 bg-background/50 px-3 py-3 text-xs text-yellow-900/75 dark:border-yellow-900 dark:text-yellow-100/75">
                  Belum ada catatan internal.
                </div>
              ) : (
                internalNotes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-md border border-yellow-200 bg-background/75 px-3 py-2 text-sm text-yellow-950 dark:border-yellow-900/70 dark:text-yellow-100"
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-yellow-800/75 dark:text-yellow-200/75">
                      <span className="font-medium">{getInternalNoteAuthor(note)}</span>
                      <span>{formatTime(note.createdAt)}</span>
                    </div>
                    <div className="whitespace-pre-wrap leading-5">{note.content}</div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-3">
              <Textarea
                placeholder="Tulis catatan untuk tim..."
                className="min-h-20 resize-none border-yellow-200 bg-background/80 pr-12 focus-visible:ring-yellow-400 focus-visible:ring-offset-0 dark:border-yellow-900/70"
                value={internalContent}
                onChange={(e) => setInternalContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    handleInternalSubmit();
                  }
                }}
              />
              <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-yellow-900/70 dark:text-yellow-100/70">
                <span>Disimpan sebagai catatan internal, bukan dikirim ke reporter.</span>
                <Button
                  size="sm"
                  className={cn(
                    "h-8 bg-yellow-500 text-yellow-950 hover:bg-yellow-600",
                    !internalContent.trim() && "opacity-60",
                  )}
                  disabled={!internalContent.trim() || isInternalLoading}
                  onClick={handleInternalSubmit}
                >
                  {isInternalLoading ? "Menyimpan..." : "Simpan Catatan"}
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="mb-3 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            aria-expanded={isInternalPanelOpen}
            onClick={() => setIsInternalPanelOpen((open) => !open)}
          >
            <RiLockLine className="size-3.5 text-yellow-600" />
            Catatan Internal
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {internalNotes.length}
            </span>
            <RiArrowDownSLine
              className={cn(
                "size-3.5 transition-transform",
                isInternalPanelOpen && "rotate-180",
              )}
            />
          </Button>

          <div className="flex items-center gap-1">
          {onRequestDraft && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={onRequestDraft}
            >
              <RiSparklingLine className="size-3.5 text-amber-600 dark:text-amber-400" />
              Draf AI
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                <RiChatQuoteLine className="size-3.5" />
                Quick Reply
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Pilih Template</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {quickReplies.map((qr) => (
                <DropdownMenuItem
                  key={qr.id}
                  onClick={() => setContent(qr.content)}
                  className="flex flex-col items-start gap-0.5 py-2"
                >
                  <span className="font-medium">{qr.label}</span>
                  <span className="line-clamp-1 text-[10px] text-muted-foreground">
                    {qr.content}
                  </span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="justify-center font-medium text-blue-600">
                Atur Quick Reply
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>

        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((file) => {
              const isImage = file.mimeType.startsWith("image/");
              return (
                <div
                  key={file.storageKey}
                  className="flex items-center gap-2 rounded-md border bg-muted/40 py-1.5 pl-2 pr-1 text-xs"
                >
                  {isImage ? (
                    <AttachmentImage
                      src={file.fileUrl}
                      alt={file.fileName}
                      className="size-8 rounded"
                    />
                  ) : (
                    <span className="flex size-8 items-center justify-center rounded bg-muted text-muted-foreground">
                      <RiFile3Line className="size-4" />
                    </span>
                  )}
                  <span className="max-w-[140px] truncate font-medium">{file.fileName}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground hover:text-foreground"
                    onClick={() => removeAttachment(file.storageKey)}
                    aria-label={`Hapus ${file.fileName}`}
                  >
                    <RiCloseLine className="size-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <div className="group relative">
          <Textarea
            placeholder="Tulis balasan untuk reporter..."
            className="min-h-[104px] resize-none bg-muted/30 pr-12 pb-12 transition-all duration-200 focus-visible:ring-blue-400 focus-visible:ring-offset-0"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleSubmit();
              }
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,application/pdf,text/plain"
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute bottom-3 left-3 size-8 text-muted-foreground hover:text-foreground"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Lampirkan berkas"
          >
            {isUploading ? (
              <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <RiAttachment2 className="size-4" />
            )}
          </Button>
          <Button
            size="icon"
            className={`absolute right-3 bottom-3 size-8 bg-blue-600 text-white transition-all hover:bg-blue-700 ${!content.trim() && attachments.length === 0 ? "translate-y-1 scale-90 opacity-0" : "translate-y-0 scale-100 opacity-100"}`}
            disabled={(!content.trim() && attachments.length === 0) || isLoading || isUploading}
            onClick={handleSubmit}
          >
            {isLoading ? (
              <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <RiSendPlane2Line className="size-4" />
            )}
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-muted-foreground">
          <span>Pesan ini akan dikirim ke reporter.</span>
          <span>
            Tekan <kbd className="rounded border bg-muted/50 px-1 font-sans">Ctrl + Enter</kbd>{" "}
            untuk kirim
          </span>
        </div>
      </div>
    </div>
  );
}

function getInternalNoteAuthor(note: TicketDetailData["messages"][0]) {
  if (note.senderType === "ai_agent") return "AI Agent";
  if (note.senderType === "staff") return note.sender?.name ?? "Staf";
  if (note.senderType === "requester") return note.requester?.displayName ?? "Pelapor";
  return "Sistem";
}
