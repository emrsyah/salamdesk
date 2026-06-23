"use client";

import { useEffect, useState } from "react";
import { useExhibitStream } from "@/app/exhibit/exhibit-stream-context";
import { cn } from "@/lib/utils";

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
        <span className="text-sky-400">
          {metrics.ticketsPerMin}
          <span className="ml-1 text-zinc-500">tiket/mnt</span>
        </span>
        <span className="text-emerald-400">
          {autoRate}%<span className="ml-1 text-zinc-500">auto-resolved</span>
        </span>
        <span className="text-zinc-300">{now}</span>
      </div>
    </header>
  );
}
