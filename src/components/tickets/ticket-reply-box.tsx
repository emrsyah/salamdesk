"use client";

import { useEffect, useRef, useState } from "react";
import {
  RiArrowDownSLine,
  RiArrowGoBackLine,
  RiAttachment2,
  RiChatQuoteLine,
  RiCloseLine,
  RiFile3Line,
  RiLockLine,
  RiMagicLine,
  RiSendPlane2Line,
  RiSparklingLine,
} from "@remixicon/react";
import { toast } from "sonner";
import { useUploadThing } from "@/lib/uploadthing";
import { useTicketDetailMutation } from "@/hooks/use-ticket-detail-mutation";
import { authClient } from "@/lib/auth/auth-client";
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
import type { RefineMode } from "@/services/triage-ai.service";

const REFINE_ACTIONS: { mode: RefineMode; label: string; hint: string }[] = [
  { mode: "perbaiki", label: "Perbaiki & rapikan", hint: "Ejaan, tata bahasa, kejelasan" },
  { mode: "perpendek", label: "Perpendek", hint: "Buang basa-basi, poin tetap" },
  { mode: "ramah", label: "Lebih ramah", hint: "Nada hangat, tetap profesional" },
  { mode: "formal", label: "Lebih formal", hint: "Bahasa baku untuk komunikasi resmi" },
];

type PendingAttachment = {
  fileName: string;
  fileUrl: string;
  storageKey: string;
  mimeType: string;
  fileSize: number;
};

// Stable empty-array default so callers that omit these props don't get a
// fresh reference each render (which would defeat downstream memoization).
const EMPTY_ARRAY: never[] = [];

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
  quickReplies = EMPTY_ARRAY,
  internalNotes = EMPTY_ARRAY,
  draftInsert,
  onRequestDraft,
  onReplySent,
}: TicketReplyBoxProps) {
  const [content, setContent] = useState("");
  const { optimisticUpdate } = useTicketDetailMutation(ticketId);
  const { data: session } = authClient.useSession();

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

  // AI refine ("Rapikan") state: which mode is running, and the pre-refine
  // text so the agent can undo with one click.
  const [refiningMode, setRefiningMode] = useState<RefineMode | "custom" | null>(null);
  const [preRefineContent, setPreRefineContent] = useState<string | null>(null);
  const [isCustomRefineOpen, setIsCustomRefineOpen] = useState(false);
  const [customInstruction, setCustomInstruction] = useState("");

  async function handleRefine(mode: RefineMode | "custom", instruction?: string) {
    if (!content.trim() || refiningMode) return;
    const original = content;
    setRefiningMode(mode);
    try {
      const { refineReplyTextAction } = await import("@/actions/ai-copilot.actions");
      const refined = await refineReplyTextAction(ticketId, original, mode, instruction);
      setPreRefineContent(original);
      setContent(refined);
      if (mode === "custom") {
        setIsCustomRefineOpen(false);
        setCustomInstruction("");
      }
    } catch (error) {
      console.error("Refine failed", error);
      toast.error("Gagal merapikan teks. Coba lagi.");
    } finally {
      setRefiningMode(null);
    }
  }

  function submitCustomRefine() {
    const instruction = customInstruction.trim();
    if (!instruction) return;
    void handleRefine("custom", instruction);
  }

  function undoRefine() {
    if (preRefineContent === null) return;
    setContent(preRefineContent);
    setPreRefineContent(null);
  }

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

  function buildOptimisticMessage(
    text: string,
    isInternalNote: boolean,
    files: PendingAttachment[],
  ): TicketDetailData["messages"][number] {
    return {
      id: `optimistic-${crypto.randomUUID()}`,
      content: text,
      senderType: "staff",
      isInternalNote,
      createdAt: new Date().toISOString(),
      sender: session?.user
        ? { id: session.user.id, name: session.user.name }
        : null,
      requester: null,
      attachments: files.map((file) => ({
        id: `optimistic-${file.storageKey}`,
        fileName: file.fileName,
        fileUrl: file.fileUrl,
        mimeType: file.mimeType,
        fileSize: file.fileSize,
      })),
      pending: true,
    };
  }

  async function handleSubmit() {
    const hasText = content.trim().length > 0;
    if ((!hasText && attachments.length === 0) || isLoading || isUploading) return;

    // Snapshot + clear the composer immediately; restore on failure.
    const sentContent = content;
    const sentAttachments = attachments;
    setContent("");
    setAttachments([]);
    setPreRefineContent(null);
    setIsLoading(true);

    const optimisticMessage = buildOptimisticMessage(sentContent, false, sentAttachments);

    try {
      await optimisticUpdate(
        (ticket) => ({ ...ticket, messages: [...ticket.messages, optimisticMessage] }),
        async () => {
          const { sendReplyAction } = await import("@/actions/messages.actions");
          await sendReplyAction({
            ticketId,
            content: sentContent,
            isInternalNote: false,
            attachments: sentAttachments.map(
              ({ fileName, fileUrl, storageKey, mimeType, fileSize }) => ({
                fileName,
                fileUrl,
                storageKey,
                mimeType,
                fileSize,
              }),
            ),
          });
        },
      );
      onReplySent?.();
    } catch (error) {
      console.error(error);
      setContent(sentContent);
      setAttachments(sentAttachments);
      toast.error("Gagal mengirim balasan. Pesan dikembalikan ke kotak balasan.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleInternalSubmit() {
    if (!internalContent.trim() || isInternalLoading) return;

    const sentContent = internalContent;
    setInternalContent("");
    setIsInternalPanelOpen(true);
    setIsInternalLoading(true);

    const optimisticMessage = buildOptimisticMessage(sentContent, true, []);

    try {
      await optimisticUpdate(
        (ticket) => ({ ...ticket, messages: [...ticket.messages, optimisticMessage] }),
        async () => {
          const { sendReplyAction } = await import("@/actions/messages.actions");
          await sendReplyAction({
            ticketId,
            content: sentContent,
            isInternalNote: true,
          });
        },
      );
      onReplySent?.();
    } catch (error) {
      console.error(error);
      setInternalContent(sentContent);
      toast.error("Gagal menyimpan catatan internal. Teks dikembalikan.");
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
          {content.trim() && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  disabled={refiningMode !== null}
                >
                  {refiningMode ? (
                    <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <RiMagicLine className="size-3.5 text-violet-600 dark:text-violet-400" />
                  )}
                  {refiningMode
                    ? (REFINE_ACTIONS.find((a) => a.mode === refiningMode)?.label ??
                      "Menerapkan…")
                    : "Rapikan"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>Ubah tulisanmu dengan AI</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {REFINE_ACTIONS.map((action) => (
                  <DropdownMenuItem
                    key={action.mode}
                    onSelect={() => handleRefine(action.mode)}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <span className="font-medium">{action.label}</span>
                    <span className="text-[10px] text-muted-foreground">{action.hint}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => setIsCustomRefineOpen(true)}
                  className="flex flex-col items-start gap-0.5 py-2"
                >
                  <span className="font-medium">Instruksi sendiri…</span>
                  <span className="text-[10px] text-muted-foreground">
                    Tulis sendiri apa yang ingin diubah
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
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

        {isCustomRefineOpen && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50/60 p-2 dark:border-violet-900/60 dark:bg-violet-950/20">
            <RiMagicLine className="size-4 shrink-0 text-violet-600 dark:text-violet-400" />
            <input
              autoFocus
              aria-label="Instruksi AI"
              value={customInstruction}
              onChange={(event) => setCustomInstruction(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitCustomRefine();
                }
                if (event.key === "Escape") {
                  setIsCustomRefineOpen(false);
                  setCustomInstruction("");
                }
              }}
              placeholder='Apa yang ingin diubah? Contoh: "tambahkan salam penutup", "jadikan langkah bernomor"'
              maxLength={500}
              disabled={refiningMode !== null}
              className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70 disabled:opacity-50"
            />
            <Button
              size="sm"
              className="h-7 shrink-0 bg-violet-600 text-white hover:bg-violet-700"
              disabled={!customInstruction.trim() || refiningMode !== null}
              onClick={submitCustomRefine}
            >
              {refiningMode === "custom" ? (
                <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                "Terapkan"
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground"
              onClick={() => {
                setIsCustomRefineOpen(false);
                setCustomInstruction("");
              }}
              aria-label="Tutup instruksi AI"
            >
              <RiCloseLine className="size-4" />
            </Button>
          </div>
        )}

        <div className="group relative">
          <Textarea
            placeholder="Tulis balasan untuk reporter..."
            className={cn(
              "min-h-[104px] resize-none bg-muted/30 pr-12 pb-12 transition-all duration-200 focus-visible:ring-blue-400 focus-visible:ring-offset-0",
              refiningMode && "animate-pulse opacity-60",
            )}
            value={content}
            readOnly={refiningMode !== null}
            onChange={(e) => {
              setContent(e.target.value);
              // Manual edits invalidate the AI-undo snapshot — restoring it
              // now would clobber the agent's own changes.
              if (preRefineContent !== null) setPreRefineContent(null);
            }}
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
            aria-label="Lampirkan berkas"
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
          {preRefineContent !== null ? (
            <span className="flex items-center gap-1.5">
              <RiMagicLine className="size-3 text-violet-600 dark:text-violet-400" />
              Teks diubah AI.
              <button
                type="button"
                onClick={undoRefine}
                className="flex items-center gap-0.5 font-medium text-foreground underline-offset-2 hover:underline"
              >
                <RiArrowGoBackLine className="size-3" />
                Kembalikan tulisan asli
              </button>
            </span>
          ) : (
            <span>Pesan ini akan dikirim ke reporter.</span>
          )}
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
