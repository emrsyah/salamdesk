"use client";

import { AnimatePresence, motion } from "motion/react";
import { useExhibitStream } from "@/app/exhibit/exhibit-stream-context";
import { clockTime, eventMeta } from "./event-meta";
import { SectionHeader } from "./section-header";
import { cn } from "@/lib/utils";

/**
 * The left-hand activity ticker: every event as it streams in, newest at the
 * top. `AnimatePresence` + `layout` give smooth enter/slide/exit; a stable
 * `key={event.id}` is required for those animations to track items correctly.
 */
export function LiveFeed() {
  const { feed } = useExhibitStream();

  return (
    <div className="flex h-full flex-col">
      <SectionHeader label="Aktivitas Langsung" accent="bg-sky-500" />
      <div className="relative flex-1 overflow-y-auto">
        <ul className="flex flex-col gap-1.5">
          <AnimatePresence initial={false}>
            {feed.map((e) => {
              const meta = eventMeta(e.type);
              return (
                <motion.li
                  key={e.id}
                  layout
                  initial={{ opacity: 0, y: -10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="rounded-md border border-zinc-200 bg-white px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("text-base leading-none", meta.accent)}>
                      ●
                    </span>
                    <span
                      className={cn(
                        "font-mono text-[10px] font-semibold tracking-wider",
                        meta.accent,
                      )}
                    >
                      {meta.tag}
                    </span>
                    <span className="ml-auto font-mono text-[10px] text-zinc-400">
                      {clockTime(e.ts)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-700">
                    {e.label}
                  </p>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
        {/* Fade the bottom so evicted rows dissolve rather than pop. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
      </div>
    </div>
  );
}
