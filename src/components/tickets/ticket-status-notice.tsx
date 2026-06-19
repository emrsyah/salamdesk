"use client";

import { RiCheckboxCircleFill, RiLock2Fill } from "@remixicon/react";
import { formatTime } from "@/lib/utils";
import type { TicketDetailData } from "./ticket-detail";

/**
 * Footer banner shown in place of the reply box once a ticket leaves the active
 * workflow. It tells the agent *why* the conversation is read-only — resolved
 * (still reopenable) vs. closed (terminal) — plus when and by whom.
 */
export function TicketStatusNotice({ ticket }: { ticket: TicketDetailData }) {
  if (ticket.status === "closed") {
    return (
      <div className="border-t bg-muted/40 px-6 py-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            <RiLock2Fill className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Tiket ini sudah ditutup</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Ditutup{ticket.closedAt ? ` ${formatTime(ticket.closedAt)}` : ""}
              {ticket.closedBy ? ` oleh ${ticket.closedBy.name}` : " secara otomatis oleh sistem"}.
              {" "}Balasan baru akan membuat tiket terkait yang baru.
            </p>
            {ticket.resolutionNote && (
              <p className="mt-2 rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground/80">Catatan penyelesaian: </span>
                {ticket.resolutionNote}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (ticket.status === "resolved") {
    return (
      <div className="border-t bg-emerald-50/60 px-6 py-3 dark:bg-emerald-950/20">
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
            <RiCheckboxCircleFill className="size-4" />
          </span>
          <p className="text-sm text-emerald-900 dark:text-emerald-200">
            <span className="font-semibold">Tiket diselesaikan</span>
            {ticket.resolvedAt ? ` ${formatTime(ticket.resolvedAt)}` : ""}
            {ticket.resolvedBy ? ` oleh ${ticket.resolvedBy.name}` : ""}. Balasan dari pelapor
            akan membuka kembali tiket ini.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
