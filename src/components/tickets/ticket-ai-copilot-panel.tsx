"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  RiArrowGoBackLine,
  RiBookOpenLine,
  RiCloseLine,
  RiCornerDownLeftLine,
  RiSearchLine,
  RiSparklingLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  CopilotArticle,
  CopilotDraft,
  CopilotSearchScope,
} from "@/actions/ai-copilot.actions";
import type { RefineMode } from "@/services/triage-ai.service";
import type { TicketDetailData } from "./ticket-detail";

const DRAFT_QUICK_ACTIONS: { mode: RefineMode; label: string }[] = [
  { mode: "perpendek", label: "Perpendek" },
  { mode: "ramah", label: "Lebih ramah" },
  { mode: "formal", label: "Lebih formal" },
];

interface TicketAiCopilotPanelProps {
  ticket: TicketDetailData;
  /** Inserts a draft into the reply box and brings it into view. */
  onUseDraft: (text: string) => void;
  onClose: () => void;
  /**
   * Bumped by the reply box's "✨ Draf" button to request an automatic
   * draft from the most relevant article without the agent searching first.
   */
  autoDraftNonce?: number;
}

function confidenceTone(confidence: number) {
  if (confidence >= 0.8) return "text-green-700 dark:text-green-400";
  if (confidence >= 0.5) return "text-amber-700 dark:text-amber-400";
  return "text-orange-700 dark:text-orange-400";
}

export function TicketAiCopilotPanel({
  ticket,
  onUseDraft,
  onClose,
  autoDraftNonce,
}: TicketAiCopilotPanelProps) {
  const [query, setQuery] = useState("");
  const [articles, setArticles] = useState<CopilotArticle[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [scope, setScope] = useState<CopilotSearchScope>("module");

  const [draft, setDraft] = useState<CopilotDraft | null>(null);
  const [draftingKbId, setDraftingKbId] = useState<string | null>(null);
  const [refiningMode, setRefiningMode] = useState<RefineMode | null>(null);
  const [previousDraftText, setPreviousDraftText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ticketId = ticket.id;

  const runSearch = useCallback(
    async (searchQuery: string, searchScope: CopilotSearchScope = "module") => {
      setIsSearching(true);
      setError(null);
      setScope(searchScope);
      try {
        const { searchKnowledgeForTicketAction } = await import(
          "@/actions/ai-copilot.actions"
        );
        const results = await searchKnowledgeForTicketAction(
          ticketId,
          searchQuery,
          searchScope,
        );
        setArticles(results);
        setHasSearched(true);
        return results;
      } catch (err) {
        console.error("Copilot search failed", err);
        setError("Gagal mencari artikel. Coba lagi.");
        return [] as CopilotArticle[];
      } finally {
        setIsSearching(false);
      }
    },
    [ticketId],
  );

  const runDraft = useCallback(
    async (kbId: string) => {
      setDraftingKbId(kbId);
      setError(null);
      try {
        const { draftReplyFromKbAction } = await import(
          "@/actions/ai-copilot.actions"
        );
        const result = await draftReplyFromKbAction(ticketId, kbId);
        setDraft(result);
        setPreviousDraftText(null);
      } catch (err) {
        console.error("Copilot draft failed", err);
        setError("Gagal membuat draf. Coba lagi.");
      } finally {
        setDraftingKbId(null);
      }
    },
    [ticketId],
  );

  const runRefine = useCallback(
    async (mode: RefineMode) => {
      if (!draft?.suggestedReply || refiningMode) return;
      const currentText = draft.suggestedReply;
      setRefiningMode(mode);
      setError(null);
      try {
        const { refineReplyTextAction } = await import(
          "@/actions/ai-copilot.actions"
        );
        const refined = await refineReplyTextAction(ticketId, currentText, mode);
        setPreviousDraftText(currentText);
        setDraft((current) =>
          current ? { ...current, suggestedReply: refined } : current,
        );
      } catch (err) {
        console.error("Copilot refine failed", err);
        setError("Gagal mengubah draf. Coba lagi.");
      } finally {
        setRefiningMode(null);
      }
    },
    [draft, refiningMode, ticketId],
  );

  function undoRefine() {
    if (previousDraftText === null) return;
    setDraft((current) =>
      current ? { ...current, suggestedReply: previousDraftText } : current,
    );
    setPreviousDraftText(null);
  }

  // Initial ticket-based retrieval when the panel opens.
  useEffect(() => {
    void runSearch("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  // "✨ Draf" button in the reply box: search, then draft the top match.
  const lastAutoDraft = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (autoDraftNonce === undefined || autoDraftNonce === lastAutoDraft.current) {
      return;
    }
    lastAutoDraft.current = autoDraftNonce;
    void (async () => {
      const results = await runSearch("");
      if (results[0]) {
        await runDraft(results[0].id);
      }
    })();
  }, [autoDraftNonce, runSearch, runDraft]);

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    void runSearch(query, scope);
  }

  const confidencePct = draft ? Math.round(draft.confidence * 100) : 0;

  return (
    <aside className="flex w-96 shrink-0 flex-col border-l bg-background">
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-400/20">
            <RiSparklingLine className="size-4 text-amber-600 dark:text-amber-400" />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold">AI Copilot</h3>
            <p className="truncate text-xs text-muted-foreground">
              Cari KB &amp; buat draf balasan
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <RiCloseLine className="size-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <form onSubmit={handleSearchSubmit} className="relative">
          <RiSearchLine className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari artikel KB..."
            className="pl-9 pr-9"
          />
          <button
            type="submit"
            aria-label="Cari"
            className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          >
            <RiCornerDownLeftLine className="size-3.5" />
          </button>
        </form>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Grounded draft */}
        {draft && (
          <div className="overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 shadow-sm dark:border-amber-800/50 dark:from-amber-950/30 dark:to-yellow-950/20">
            <div className="flex items-center gap-2 border-b border-amber-200/70 px-3 py-2 dark:border-amber-800/30">
              <RiSparklingLine className="size-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Draf balasan
              </span>
              {draft.suggestedReply && (
                <span className={`ml-auto text-xs font-medium ${confidenceTone(draft.confidence)}`}>
                  {confidencePct}% yakin
                </span>
              )}
            </div>
            <div className="space-y-2 px-3 py-3">
              <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                <RiBookOpenLine className="size-3.5 shrink-0" />
                <span className="truncate">Dari: {draft.kbTitle}</span>
              </p>
              {draft.suggestedReply ? (
                <>
                  <p
                    className={`whitespace-pre-wrap text-sm leading-relaxed text-amber-900 transition-opacity dark:text-amber-200 ${refiningMode ? "opacity-50" : ""}`}
                  >
                    {draft.suggestedReply}
                  </p>

                  {/* Quick refinements — rewrite the draft in place. */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {DRAFT_QUICK_ACTIONS.map((action) => (
                      <button
                        key={action.mode}
                        type="button"
                        disabled={refiningMode !== null}
                        onClick={() => runRefine(action.mode)}
                        className="rounded-full border border-amber-300/70 bg-background/60 px-2.5 py-1 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-900/40"
                      >
                        {refiningMode === action.mode ? (
                          <span className="flex items-center gap-1.5">
                            <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            {action.label}
                          </span>
                        ) : (
                          action.label
                        )}
                      </button>
                    ))}
                    {previousDraftText !== null && !refiningMode && (
                      <button
                        type="button"
                        onClick={undoRefine}
                        className="ml-auto flex items-center gap-1 text-xs text-amber-700 underline-offset-2 hover:underline dark:text-amber-400"
                      >
                        <RiArrowGoBackLine className="size-3" />
                        Kembalikan
                      </button>
                    )}
                  </div>

                  <Button
                    size="sm"
                    className="w-full bg-amber-500 text-amber-950 hover:bg-amber-600"
                    disabled={refiningMode !== null}
                    onClick={() => onUseDraft(draft.suggestedReply!)}
                  >
                    Gunakan balasan ini
                  </Button>
                </>
              ) : (
                <p className="text-sm text-amber-800/80 dark:text-amber-300/70">
                  Artikel ini sepertinya tidak menjawab masalah tiket. Coba artikel lain.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Related articles */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Artikel terkait
            </p>
            {/* Explicit scope toggle: this module vs. every module. */}
            <div className="flex items-center rounded-full border p-0.5 text-[11px]">
              {(
                [
                  { value: "module", label: "Modul ini" },
                  { value: "all", label: "Semua" },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={scope === option.value}
                  disabled={isSearching}
                  onClick={() => {
                    if (scope !== option.value) void runSearch(query, option.value);
                  }}
                  className={
                    "rounded-full px-2 py-0.5 font-medium transition-colors disabled:opacity-50 " +
                    (scope === option.value
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {isSearching ? (
            <p className="text-sm text-muted-foreground">Mencari...</p>
          ) : articles.length === 0 ? (
            <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              {!hasSearched ? (
                "Belum ada artikel."
              ) : scope === "module" ? (
                <div className="space-y-2">
                  <p>Tidak ada artikel di modul ini.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => void runSearch(query, "all")}
                  >
                    <RiBookOpenLine className="size-3.5" />
                    Cari di semua modul
                  </Button>
                </div>
              ) : (
                "Tidak ada artikel yang cocok di semua modul."
              )}
            </div>
          ) : (
            articles.map((article) => (
              <div
                key={article.id}
                className="rounded-md border p-3 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-sm font-medium">{article.title}</p>
                  {article.isFromOtherModule && (
                    <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Modul lain
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {article.snippet}…
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 h-7 gap-1.5 text-xs"
                  disabled={draftingKbId === article.id}
                  onClick={() => runDraft(article.id)}
                >
                  <RiSparklingLine className="size-3.5 text-amber-600 dark:text-amber-400" />
                  {draftingKbId === article.id ? "Membuat draf..." : "Buat draf"}
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
