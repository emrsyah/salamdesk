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
      <dd className="mt-0.5 text-sm text-zinc-800">{value}</dd>
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = {
  completed: "border border-emerald-200/70 bg-emerald-50 text-emerald-700",
  processing: "border border-sky-200/70 bg-sky-50 text-sky-700",
  failed: "border border-red-200/70 bg-red-50 text-red-700",
  skipped: "border border-zinc-200 bg-zinc-50 text-zinc-500",
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
        className="font-mono text-xs text-zinc-500 hover:text-zinc-900"
      >
        ← Kembali ke wall
      </Link>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">
        {ticket.title}
      </h1>
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
                className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-mono text-[10px] font-medium",
                      STATUS_COLOR[e.status] ??
                        "border border-zinc-200 bg-zinc-50 text-zinc-500",
                    )}
                  >
                    {e.status}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-500">
                    {e.trigger}
                  </span>
                  <span className="ml-auto font-mono text-[10px] text-zinc-400">
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
                  <p className="mt-3 text-xs text-zinc-600">
                    <span className="text-zinc-400">Alasan modul: </span>
                    {e.moduleReason}
                  </p>
                )}
                {e.suggestedReply && (
                  <p className="mt-2 rounded-lg border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-2 text-xs text-zinc-800">
                    {e.suggestedReply}
                  </p>
                )}
                {e.autoReplyBlockedReason && (
                  <p className="mt-2 text-xs text-amber-700">
                    {e.autoReplyBlockedReason}
                  </p>
                )}
                {e.error && (
                  <p className="mt-2 text-xs text-red-600">{e.error}</p>
                )}
              </div>
            ))}
            {events.length === 0 && (
              <p className="text-sm text-zinc-400">Belum ada triage.</p>
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
                  "rounded-xl border px-3 py-2 text-sm",
                  m.senderType === "requester"
                    ? "border-zinc-200 bg-zinc-50 text-zinc-800"
                    : m.senderType === "ai_agent"
                      ? "border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 text-zinc-800"
                      : "border-sky-200/70 bg-sky-50 text-sky-900",
                )}
              >
                <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                  {m.senderType}
                </p>
                {m.content}
              </div>
            ))}
            {messages.length === 0 && (
              <p className="text-sm text-zinc-400">Belum ada pesan.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
