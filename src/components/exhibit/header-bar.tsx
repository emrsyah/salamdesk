"use client";

import { useEffect, useState } from "react";
import { useExhibitStream } from "@/app/exhibit/exhibit-stream-context";
import { formatDuration } from "./event-meta";
import { cn } from "@/lib/utils";

/** Fires a scripted demo ticket onto the wall — for quiet booth moments. */
function DemoButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch("/api/exhibit/demo", { method: "POST" });
        } catch {
          /* best-effort */
        } finally {
          // The flow plays out over a few seconds server-side; re-enable after.
          setTimeout(() => setBusy(false), 6_000);
        }
      }}
      className={cn(
        "rounded-full border border-white/10 px-3 py-1 text-xs font-semibold transition",
        busy
          ? "cursor-not-allowed text-zinc-600"
          : "text-zinc-300 hover:border-white/30 hover:text-white",
      )}
    >
      {busy ? "Memutar…" : "▶ Demo"}
    </button>
  );
}

/** Top bar: brand, live connection pulse, headline metrics, wall clock. */
export function HeaderBar() {
  const { connected, metrics } = useExhibitStream();
  const [now, setNow] = useState<string>("");

  useEffect(() => {
    const fmt = () =>
      setNow(
        new Intl.DateTimeFormat("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date()),
      );
    fmt();
    const id = setInterval(fmt, 10_000);
    return () => clearInterval(id);
  }, []);

  const totalReplies = metrics.autoReplied + metrics.drafted;
  const autoRate =
    totalReplies > 0
      ? Math.round((metrics.autoReplied / totalReplies) * 100)
      : 0;

  return (
    <header className="flex items-center justify-between border-b border-white/10 px-8 py-4">
      <div className="flex items-center gap-3">
        <span className="text-xl font-bold tracking-tight">SalamDesk</span>
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold",
            connected
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-zinc-700/30 text-zinc-500",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              connected ? "animate-pulse bg-emerald-400" : "bg-zinc-500",
            )}
          />
          {connected ? "LIVE" : "OFFLINE"}
        </span>
      </div>
      <div className="flex items-center gap-8 font-mono text-sm">
        <span className="flex items-baseline gap-1.5 text-amber-300">
          <span className="text-base">⚡</span>
          <span className="text-lg font-bold tabular-nums">
            {metrics.lastReplyMs != null ? formatDuration(metrics.lastReplyMs) : "—"}
          </span>
          <span className="text-zinc-500">waktu jawab</span>
        </span>
        <span className="text-emerald-400 tabular-nums">
          {metrics.resolved}
          <span className="ml-1 text-zinc-500">selesai</span>
        </span>
        <span className="text-sky-400 tabular-nums">
          {metrics.ticketsPerMin}
          <span className="ml-1 text-zinc-500">tiket/mnt</span>
        </span>
        <span className="text-emerald-400 tabular-nums">
          {autoRate}%<span className="ml-1 text-zinc-500">otomatis</span>
        </span>
        <span className="text-zinc-300">{now}</span>
        <DemoButton />
      </div>
    </header>
  );
}
