"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
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
} from "@/actions/ai-copilot.actions";
import type { TicketDetailData } from "./ticket-detail";

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

  const [draft, setDraft] = useState<CopilotDraft | null>(null);
  const [draftingKbId, setDraftingKbId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ticketId = ticket.id;

  const runSearch = useCallback(
    async (searchQuery: string) => {
      setIsSearching(true);
      setError(null);
      try {
        const { searchKnowledgeForTicketAction } = await import(
          "@/actions/ai-copilot.actions"
        );
        const results = await searchKnowledgeForTicketAction(ticketId, searchQuery);
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
      } catch (err) {
        console.error("Copilot draft failed", err);
        setError("Gagal membuat draf. Coba lagi.");
      } finally {
        setDraftingKbId(null);
      }
    },
    [ticketId],
  );

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
    void runSearch(query);
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
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-amber-900 dark:text-amber-200">
                    {draft.suggestedReply}
                  </p>
                  <Button
                    size="sm"
                    className="w-full bg-amber-500 text-amber-950 hover:bg-amber-600"
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
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Artikel terkait
          </p>
          {isSearching ? (
            <p className="text-sm text-muted-foreground">Mencari...</p>
          ) : articles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {hasSearched
                ? "Tidak ada artikel yang cocok."
                : "Belum ada artikel."}
            </p>
          ) : (
            articles.map((article) => (
              <div
                key={article.id}
                className="rounded-md border p-3 transition-colors hover:bg-muted/40"
              >
                <p className="line-clamp-2 text-sm font-medium">{article.title}</p>
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
