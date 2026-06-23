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
        "rounded-full px-4 py-1.5 text-xs font-semibold transition-transform duration-200",
        busy
          ? "cursor-not-allowed bg-muted text-muted-foreground"
          : "bg-primary text-primary-foreground hover:scale-[1.03] active:scale-95",
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
    <header className="flex items-center justify-between border-b border-border/60 bg-background/70 px-8 py-4 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <img
          src="/android-chrome-512x512.png"
          alt="SalamDesk"
          className="size-8 rounded-lg"
        />
        <span className="text-xl font-bold tracking-tight text-foreground">
          SalamDesk
        </span>
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium leading-4",
            connected
              ? "border-emerald-200/70 bg-emerald-50 text-emerald-700"
              : "border-zinc-200 bg-zinc-50 text-zinc-500",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              connected ? "animate-pulse bg-emerald-500" : "bg-zinc-400",
            )}
          />
          {connected ? "LIVE" : "OFFLINE"}
        </span>
      </div>
      <div className="flex items-center gap-8 font-mono text-sm">
        <span className="flex items-baseline gap-1.5 text-amber-600">
          <span className="text-base">⚡</span>
          <span className="text-lg font-bold tabular-nums">
            {metrics.lastReplyMs != null ? formatDuration(metrics.lastReplyMs) : "—"}
          </span>
          <span className="text-zinc-500">waktu jawab</span>
        </span>
        <span className="text-emerald-600 tabular-nums">
          {metrics.resolved}
          <span className="ml-1 text-zinc-500">selesai</span>
        </span>
        <span className="text-sky-600 tabular-nums">
          {metrics.ticketsPerMin}
          <span className="ml-1 text-zinc-500">tiket/mnt</span>
        </span>
        <span className="text-emerald-600 tabular-nums">
          {autoRate}%<span className="ml-1 text-zinc-500">otomatis</span>
        </span>
        <span className="text-zinc-600">{now}</span>
        <DemoButton />
      </div>
    </header>
  );
}
