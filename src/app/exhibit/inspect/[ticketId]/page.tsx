import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { ticketMessages, tickets } from "@/db/schema/tickets";
import { triageEvents } from "@/db/schema/triage";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function pctNum(value: string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** Tinted-50 / 200-border / 700-text status pill — the SalamDesk chip recipe. */
const STATUS_PILL: Record<string, string> = {
  completed: "border-emerald-200/70 bg-emerald-50 text-emerald-700",
  processing: "border-sky-200/70 bg-sky-50 text-sky-700",
  failed: "border-red-200/70 bg-red-50 text-red-700",
  skipped: "border-zinc-200 bg-zinc-50 text-zinc-500",
};

/** The timeline node dot fill, by event status. */
const STATUS_DOT: Record<string, string> = {
  completed: "bg-emerald-500",
  processing: "bg-sky-500",
  failed: "bg-red-500",
  skipped: "bg-zinc-300",
};

const PRIORITY_PILL: Record<string, string> = {
  low: "border-blue-200/70 bg-blue-50 text-blue-700",
  medium: "border-orange-200/70 bg-orange-50 text-orange-700",
  normal: "border-orange-200/70 bg-orange-50 text-orange-700",
  high: "border-red-200/70 bg-red-50 text-red-700",
  critical: "border-red-200/70 bg-red-50 text-red-700",
};

const TICKET_STATUS_PILL: Record<string, string> = {
  open: "border-sky-200/70 bg-sky-50 text-sky-700",
  in_progress: "border-violet-200/70 bg-violet-50 text-violet-700",
  resolved: "border-emerald-200/70 bg-emerald-50 text-emerald-700",
  closed: "border-slate-200/70 bg-slate-50 text-slate-600",
};

/** Human label + icon for the raw triage trigger codes. */
const TRIGGER_META: Record<string, { icon: string; label: string }> = {
  intake: { icon: "💬", label: "Pesan masuk" },
  message_added: { icon: "✉️", label: "Pesan baru" },
  reclassify: { icon: "🔁", label: "Klasifikasi ulang" },
  manual: { icon: "🖐️", label: "Tinjauan manual" },
};

function triggerMeta(trigger: string) {
  return TRIGGER_META[trigger] ?? { icon: "•", label: trigger };
}

function Pill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium leading-4",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A labelled confidence meter — bar + percentage, colored by strength. */
function Confidence({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;
  const tone =
    value >= 80
      ? "bg-emerald-500"
      : value >= 50
        ? "bg-amber-500"
        : "bg-red-500";
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
          {label}
        </span>
        <span className="font-mono text-xs font-semibold tabular-nums text-zinc-700">
          {value}%
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-zinc-800">{value}</dd>
    </div>
  );
}

/**
 * Booth drill-down — the full reasoning case file for one ticket: a vertical
 * triage timeline (read from the `triage_events` audit log) beside the WhatsApp
 * conversation thread. Lets staff explain "what happened there?" at the booth.
 */
export default async function InspectPage({
  params,
  searchParams,
}: {
  params: Promise<{ ticketId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  // This page reads full ticket conversations straight from the DB, so it must
  // honour the same kiosk gate as the SSE/demo routes. When EXHIBIT_TOKEN is
  // set, callers need a matching `?token=` (the wall forwards it on its links);
  // otherwise we 404 rather than reveal whether the ticket exists.
  const expectedToken = process.env.EXHIBIT_TOKEN;
  let tokenQuery = "";
  if (expectedToken) {
    const { token } = await searchParams;
    if (token !== expectedToken) notFound();
    tokenQuery = `?token=${encodeURIComponent(token)}`;
  }

  const { ticketId } = await params;

  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
    columns: { id: true, title: true, status: true, priority: true },
  });
  if (!ticket) notFound();

  const [events, messages] = await Promise.all([
    db
      .select()
      .from(triageEvents)
      .where(eq(triageEvents.ticketId, ticketId))
      .orderBy(asc(triageEvents.createdAt)),
    db
      .select({
        id: ticketMessages.id,
        senderType: ticketMessages.senderType,
        content: ticketMessages.content,
        createdAt: ticketMessages.createdAt,
      })
      .from(ticketMessages)
      .where(eq(ticketMessages.ticketId, ticketId))
      .orderBy(asc(ticketMessages.createdAt)),
  ]);

  // Outcome summary, read from the latest event that carries each signal.
  const lastModule = [...events].reverse().find((e) => e.moduleName)?.moduleName ?? null;
  const lastReplyConf = [...events]
    .reverse()
    .find((e) => e.replyConfidence != null)?.replyConfidence ?? null;
  const autoReplied = events.some((e) => e.autoReplySent);

  const timeFmt = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateTimeFmt = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/40 via-background to-background">
      {/* Sticky context header */}
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <Link
            href={`/exhibit${tokenQuery}`}
            className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-500 transition-colors hover:text-zinc-900"
          >
            ← Kembali ke wall
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
              {ticket.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <Pill
                className={
                  TICKET_STATUS_PILL[ticket.status] ??
                  "border-zinc-200 bg-zinc-50 text-zinc-500"
                }
              >
                {ticket.status}
              </Pill>
              {ticket.priority && (
                <Pill
                  className={
                    PRIORITY_PILL[ticket.priority] ??
                    "border-zinc-200 bg-zinc-50 text-zinc-500"
                  }
                >
                  {ticket.priority}
                </Pill>
              )}
            </div>
          </div>
          <p className="mt-1 font-mono text-[11px] text-zinc-400">{ticket.id}</p>

          {/* Outcome strip */}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600">
              <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                Langkah
              </span>
              <span className="font-semibold text-zinc-900">{events.length}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600">
              <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                Pesan
              </span>
              <span className="font-semibold text-zinc-900">{messages.length}</span>
            </span>
            {lastModule && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200/70 bg-violet-50 px-3 py-1.5 text-xs text-violet-700">
                🎯 {lastModule}
              </span>
            )}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs",
                autoReplied
                  ? "border-emerald-200/70 bg-emerald-50 text-emerald-700"
                  : "border-amber-200/70 bg-amber-50 text-amber-700",
              )}
            >
              {autoReplied ? "✓ Auto-reply terkirim" : "✍️ Draf untuk staf"}
            </span>
            {lastReplyConf != null && pctNum(lastReplyConf) != null && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600">
                <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                  Keyakinan
                </span>
                <span className="font-semibold text-zinc-900">
                  {pctNum(lastReplyConf)}%
                </span>
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-8 px-6 py-8 lg:grid-cols-[1.5fr_1fr]">
        {/* Triage timeline */}
        <section>
          <h2 className="mb-4 font-mono text-xs font-semibold uppercase tracking-widest text-zinc-700">
            Jejak Triage ({events.length})
          </h2>
          {events.length === 0 ? (
            <p className="text-sm text-zinc-400">Belum ada triage.</p>
          ) : (
            <ol className="relative flex flex-col gap-4 border-l border-zinc-200 pl-6">
              {events.map((e) => {
                const trig = triggerMeta(e.trigger);
                const moduleConf = pctNum(e.moduleConfidence);
                const replyConf = pctNum(e.replyConfidence);
                return (
                  <li key={e.id} className="relative">
                    {/* Timeline node */}
                    <span
                      className={cn(
                        "absolute -left-[31px] top-1.5 size-3 rounded-full ring-4 ring-background",
                        STATUS_DOT[e.status] ?? "bg-zinc-300",
                      )}
                    />
                    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="text-base leading-none">{trig.icon}</span>
                        <span className="text-sm font-semibold text-zinc-900">
                          {trig.label}
                        </span>
                        <Pill
                          className={
                            STATUS_PILL[e.status] ??
                            "border-zinc-200 bg-zinc-50 text-zinc-500"
                          }
                        >
                          {e.status}
                        </Pill>
                        <span className="ml-auto font-mono text-[10px] text-zinc-400">
                          {dateTimeFmt.format(e.createdAt)}
                        </span>
                      </div>

                      <dl className="grid grid-cols-2 gap-3">
                        <Field
                          label="Modul"
                          value={
                            e.moduleName
                              ? `${e.moduleName}${moduleConf != null ? ` · ${moduleConf}%` : ""}`
                              : null
                          }
                        />
                        <Field label="Prioritas" value={e.priority} />
                        <Field label="KB" value={e.suggestedKbTitle} />
                        <Field label="Model" value={e.model} />
                        <Field
                          label="Auto-reply"
                          value={
                            e.autoReplySent
                              ? "Terkirim"
                              : e.autoReplyAllowed
                                ? "Diizinkan"
                                : "Ditahan"
                          }
                        />
                      </dl>

                      {(moduleConf != null || replyConf != null) && (
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <Confidence label="Keyakinan modul" value={moduleConf} />
                          <Confidence label="Keyakinan jawaban" value={replyConf} />
                        </div>
                      )}

                      {e.moduleReason && (
                        <p className="mt-3 border-l-2 border-zinc-200 pl-3 text-xs leading-relaxed text-zinc-600">
                          {e.moduleReason}
                        </p>
                      )}
                      {e.suggestedReply && (
                        <div className="mt-3 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-3 shadow-sm">
                          <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-amber-600">
                            ✦ Saran jawaban
                          </p>
                          <p className="text-sm leading-relaxed text-zinc-800">
                            {e.suggestedReply}
                          </p>
                        </div>
                      )}
                      {e.autoReplyBlockedReason && (
                        <p className="mt-2 inline-flex items-start gap-1.5 text-xs text-amber-700">
                          <span>⚠️</span>
                          {e.autoReplyBlockedReason}
                        </p>
                      )}
                      {e.error && (
                        <p className="mt-2 inline-flex items-start gap-1.5 text-xs text-red-600">
                          <span>✕</span>
                          {e.error}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* Conversation thread */}
        <section>
          <h2 className="mb-4 font-mono text-xs font-semibold uppercase tracking-widest text-zinc-700">
            Percakapan ({messages.length})
          </h2>
          {messages.length === 0 ? (
            <p className="text-sm text-zinc-400">Belum ada pesan.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((m) => {
                const isRequester = m.senderType === "requester";
                const isAi = m.senderType === "ai_agent";
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex flex-col",
                      isRequester ? "items-start" : "items-end",
                    )}
                  >
                    <span className="mb-1 px-1 font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                      {isRequester
                        ? "Pelanggan"
                        : isAi
                          ? "✦ Asisten AI"
                          : "Staf"}
                    </span>
                    <div
                      className={cn(
                        "max-w-[88%] rounded-2xl border px-3.5 py-2 text-sm leading-relaxed shadow-sm",
                        isRequester
                          ? "rounded-tl-sm border-zinc-200 bg-white text-zinc-800"
                          : isAi
                            ? "rounded-tr-sm border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 text-zinc-800"
                            : "rounded-tr-sm border-sky-200/70 bg-sky-50 text-sky-900",
                      )}
                    >
                      {m.content}
                    </div>
                    <span className="mt-1 px-1 font-mono text-[10px] text-zinc-300">
                      {timeFmt.format(m.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
