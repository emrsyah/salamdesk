import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { ticketMessages, tickets } from "@/db/schema/tickets";
import { triageEvents } from "@/db/schema/triage";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function pct(value: string | null): string {
  if (value == null) return "—";
  const n = Number(value);
  return Number.isFinite(n) ? `${Math.round(n * 100)}%` : "—";
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-zinc-200">{value}</dd>
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = {
  completed: "bg-emerald-500/15 text-emerald-400",
  processing: "bg-sky-500/15 text-sky-400",
  failed: "bg-rose-500/15 text-rose-400",
  skipped: "bg-zinc-600/20 text-zinc-400",
};

/**
 * Booth drill-down: the full triage reasoning trail for one ticket, read
 * straight from the `triage_events` audit log plus the message thread. Useful
 * for staff to explain "what happened there?" at the booth.
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
  if (expectedToken) {
    const { token } = await searchParams;
    if (token !== expectedToken) notFound();
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

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Link
        href="/exhibit"
        className="font-mono text-xs text-zinc-500 hover:text-zinc-300"
      >
        ← Kembali ke wall
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-zinc-100">{ticket.title}</h1>
      <p className="mt-1 font-mono text-xs text-zinc-500">
        {ticket.status} · {ticket.priority} · {ticket.id}
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {/* Triage trail */}
        <section>
          <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-zinc-500">
            Triage Trail ({events.length})
          </h2>
          <div className="flex flex-col gap-3">
            {events.map((e) => (
              <div
                key={e.id}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold",
                      STATUS_COLOR[e.status] ?? "bg-zinc-600/20 text-zinc-400",
                    )}
                  >
                    {e.status}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-500">
                    {e.trigger}
                  </span>
                  <span className="ml-auto font-mono text-[10px] text-zinc-600">
                    {new Intl.DateTimeFormat("id-ID", {
                      dateStyle: "short",
                      timeStyle: "medium",
                    }).format(e.createdAt)}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-3">
                  <Field
                    label="Modul"
                    value={
                      e.moduleName
                        ? `${e.moduleName} (${pct(e.moduleConfidence)})`
                        : null
                    }
                  />
                  <Field label="Prioritas" value={e.priority} />
                  <Field label="KB" value={e.suggestedKbTitle} />
                  <Field label="Reply confidence" value={pct(e.replyConfidence)} />
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
                  <Field label="Model" value={e.model} />
                </dl>
                {e.moduleReason && (
                  <p className="mt-3 text-xs text-zinc-400">
                    <span className="text-zinc-600">Alasan modul: </span>
                    {e.moduleReason}
                  </p>
                )}
                {e.suggestedReply && (
                  <p className="mt-2 rounded-lg bg-white/[0.03] p-2 text-xs text-zinc-300">
                    {e.suggestedReply}
                  </p>
                )}
                {e.autoReplyBlockedReason && (
                  <p className="mt-2 text-xs text-amber-400/80">
                    {e.autoReplyBlockedReason}
                  </p>
                )}
                {e.error && (
                  <p className="mt-2 text-xs text-rose-400">{e.error}</p>
                )}
              </div>
            ))}
            {events.length === 0 && (
              <p className="text-sm text-zinc-600">Belum ada triage.</p>
            )}
          </div>
        </section>

        {/* Message thread */}
        <section>
          <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-zinc-500">
            Percakapan ({messages.length})
          </h2>
          <div className="flex flex-col gap-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm",
                  m.senderType === "requester"
                    ? "bg-white/[0.04] text-zinc-200"
                    : m.senderType === "ai_agent"
                      ? "bg-emerald-500/10 text-emerald-100"
                      : "bg-sky-500/10 text-sky-100",
                )}
              >
                <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                  {m.senderType}
                </p>
                {m.content}
              </div>
            ))}
            {messages.length === 0 && (
              <p className="text-sm text-zinc-600">Belum ada pesan.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
