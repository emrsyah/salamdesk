"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useExhibitStream } from "@/app/exhibit/exhibit-stream-context";
import { formatDuration } from "./event-meta";
import { cn } from "@/lib/utils";

/** Opens the guided, step-by-step demo of how the agent processes a message. */
function DemoButton() {
  return (
    <Link
      href="/exhibit/demo"
      className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-transform duration-200 hover:scale-[1.03] active:scale-95"
    >
      ▶ Demo
    </Link>
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
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border/60 bg-background/70 px-4 py-3 backdrop-blur-md sm:px-8 sm:py-4">
      <div className="flex items-center gap-2 sm:gap-3">
        <img
          src="/android-chrome-512x512.png"
          alt="SalamDesk"
          className="size-7 rounded-lg sm:size-8"
        />
        <span className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
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
      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 font-mono text-xs sm:gap-x-8 sm:text-sm">
        <span className="flex items-baseline gap-1.5 text-amber-600">
          <span className="text-sm sm:text-base">⚡</span>
          <span className="text-base font-bold tabular-nums sm:text-lg">
            {metrics.lastReplyMs != null ? formatDuration(metrics.lastReplyMs) : "—"}
          </span>
          <span className="text-zinc-500">waktu jawab</span>
        </span>
        <span className="text-emerald-600 tabular-nums">
          {metrics.resolved}
          <span className="ml-1 text-zinc-500">selesai</span>
        </span>
        <span className="hidden text-sky-600 tabular-nums sm:inline">
          {metrics.ticketsPerMin}
          <span className="ml-1 text-zinc-500">tiket/mnt</span>
        </span>
        <span className="hidden text-emerald-600 tabular-nums sm:inline">
          {autoRate}%<span className="ml-1 text-zinc-500">otomatis</span>
        </span>
        <span className="hidden text-zinc-600 sm:inline">{now}</span>
        <DemoButton />
      </div>
    </header>
  );
}
