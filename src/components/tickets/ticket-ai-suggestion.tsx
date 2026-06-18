"use client";

import { useState } from "react";
import { RiSparklingLine, RiThumbUpLine, RiThumbDownLine, RiCheckLine, RiBookOpenLine, RiCloseLine } from "@remixicon/react";
import { markSuggestionHelpfulAction } from "@/actions/ai-suggestions.actions";

export type AiSuggestionData = {
  id: string;
  confidenceScore: string | null;
  wasHelpful: boolean | null;
  knowledgeBase: {
    id: string;
    title: string;
    content: string;
  } | null;
};

interface TicketAiSuggestionProps {
  suggestion: AiSuggestionData;
  /** The AI bot message content, if an auto-reply was sent */
  aiReply?: string | null;
  onFeedback?: () => void;
}

export function TicketAiSuggestion({
  suggestion,
  aiReply,
  onFeedback,
}: TicketAiSuggestionProps) {
  const [wasHelpful, setWasHelpful] = useState<boolean | null>(
    suggestion.wasHelpful
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const confidence = suggestion.confidenceScore
    ? Math.round(parseFloat(suggestion.confidenceScore) * 100)
    : 0;

  const confidenceColor =
    confidence >= 80
      ? "text-green-700"
      : confidence >= 50
        ? "text-amber-700"
        : "text-orange-700";

  async function handleFeedback(helpful: boolean) {
    if (isSubmitting || wasHelpful !== null) return;
    setIsSubmitting(true);
    try {
      await markSuggestionHelpfulAction(suggestion.id, helpful);
      setWasHelpful(helpful);
      onFeedback?.();
    } catch (err) {
      console.error("Failed to submit feedback:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-6 mb-4 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20 dark:border-amber-800/50 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-amber-200/70 dark:border-amber-800/30">
        <div className="flex items-center justify-center size-7 rounded-full bg-amber-400/20 dark:bg-amber-400/10 shrink-0">
          <RiSparklingLine className="size-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Saran AI
          </span>
          {confidence > 0 && (
            <span className={`ml-2 text-xs font-medium ${confidenceColor}`}>
              {confidence}% yakin
            </span>
          )}
        </div>
        {wasHelpful !== null && (
          <span className="flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
            <RiCheckLine className="size-3" />
            Feedback diterima
          </span>
        )}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Tutup saran AI"
          className="flex items-center justify-center size-6 rounded-md text-amber-600/70 dark:text-amber-400/70 hover:bg-amber-200/60 dark:hover:bg-amber-800/40 hover:text-amber-800 dark:hover:text-amber-200 transition-colors shrink-0"
        >
          <RiCloseLine className="size-4" />
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {/* KB article match */}
        {suggestion.knowledgeBase && (
          <div className="flex items-start gap-2.5 text-sm">
            <RiBookOpenLine className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-0.5">
                Artikel KB yang relevan:
              </p>
              <p className="font-medium text-amber-900 dark:text-amber-200 truncate">
                {suggestion.knowledgeBase.title}
              </p>
              <p className="text-xs text-amber-800/70 dark:text-amber-300/60 mt-1 line-clamp-2">
                {suggestion.knowledgeBase.content.slice(0, 150)}…
              </p>
            </div>
          </div>
        )}

        {/* AI auto-reply preview */}
        {aiReply && (
          <div className="rounded-lg bg-white/60 dark:bg-amber-950/40 border border-amber-200/50 dark:border-amber-800/30 p-3">
            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-1.5">
              Balasan otomatis yang dikirimkan:
            </p>
            <p className="text-sm text-amber-900 dark:text-amber-200 whitespace-pre-wrap leading-relaxed line-clamp-4">
              {aiReply}
            </p>
          </div>
        )}

        {!suggestion.knowledgeBase && !aiReply && (
          <p className="text-sm text-amber-800/70 dark:text-amber-300/60">
            AI telah mengklasifikasikan tiket ini, tetapi tidak menemukan artikel KB yang relevan.
          </p>
        )}
      </div>

      {/* Feedback footer */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-amber-200/70 dark:border-amber-800/30 bg-amber-50/50 dark:bg-amber-950/20">
        <span className="text-xs text-amber-700/70 dark:text-amber-400/60 flex-1">
          Apakah saran ini membantu?
        </span>
        {wasHelpful === null ? (
          <>
            <button
              onClick={() => handleFeedback(true)}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-200/60 dark:hover:bg-amber-800/40 transition-colors disabled:opacity-50"
            >
              <RiThumbUpLine className="size-3.5" />
              Membantu
            </button>
            <button
              onClick={() => handleFeedback(false)}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-200/60 dark:hover:bg-amber-800/40 transition-colors disabled:opacity-50"
            >
              <RiThumbDownLine className="size-3.5" />
              Tidak Membantu
            </button>
          </>
        ) : (
          <span className="text-xs text-amber-700 dark:text-amber-400">
            {wasHelpful ? "👍 Ditandai membantu" : "👎 Ditandai tidak membantu"}
          </span>
        )}
      </div>
    </div>
  );
}
