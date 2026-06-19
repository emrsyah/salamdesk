"use client";

import { useState } from "react";
import {
  RiInboxLine,
  RiUserLine,
  RiCircleLine,
  RiProgress3Line,
  RiCheckboxCircleLine,
  RiTimerLine,
  RiSparklingLine,
  RiSearchLine,
  RiAttachment2,
  RiSendPlaneFill,
  RiLockLine,
} from "@remixicon/react";

/**
 * An interactive, scaled-down recreation of the SalamDesk ticket inbox built
 * entirely from the product's own design tokens. The sidebar filters (and the
 * SIMRS modules) drive the list, and selecting a ticket swaps the detail pane —
 * a Linear-style live demo so the landing surface mirrors the real app.
 */

type Status = "open" | "in_progress" | "resolved";
type Priority = "medium" | "critical";

type Ticket = {
  id: string;
  title: string;
  requester: string;
  source: string;
  module: { name: string; color: string };
  status: Status;
  priority: Priority;
  mine: boolean;
  breached: boolean;
  sla: { label: string; text: string; tone: "safe" | "warning" | "breached" }[];
  messages: { from: "user" | "ai"; text: string }[];
  ai: { confidence: number; kbTitle: string } | null;
};

const MODULES = [
  { id: "billing", name: "Billing", color: "#f97316" },
  { id: "farmasi", name: "Farmasi", color: "#eab308" },
  { id: "lab", name: "Laboratorium", color: "#3b82f6" },
  { id: "radiologi", name: "Radiologi", color: "#a855f7" },
];

const TICKETS: Ticket[] = [
  {
    id: "#D8579A8C",
    title: "Cara bayar tiket",
    requester: "Binar",
    source: "WhatsApp",
    module: { name: "Billing", color: "#f97316" },
    status: "open",
    priority: "medium",
    mine: false,
    breached: true,
    sla: [{ label: "Resolusi", text: "Lewat 28j 10m", tone: "breached" }],
    messages: [
      { from: "user", text: "Cara bayar tiket" },
      {
        from: "ai",
        text: "Halo, terima kasih telah menghubungi Salamdesk Bot. Berdasarkan judul tiket Anda, berikut panduan singkat untuk proses pembayaran…",
      },
    ],
    ai: { confidence: 60, kbTitle: "Panduan Pembayaran & Cetak Kwitansi" },
  },
  {
    id: "#DC6EC78D",
    title: "Error pas cetak kwitansi",
    requester: "Fifinella Rahma",
    source: "Web",
    module: { name: "Billing", color: "#f97316" },
    status: "in_progress",
    priority: "critical",
    mine: true,
    breached: true,
    sla: [
      { label: "Respons", text: "Lewat 30j 37m", tone: "breached" },
      { label: "Resolusi", text: "Lewat 29j", tone: "breached" },
    ],
    messages: [
      { from: "user", text: "Pas cetak kwitansi muncul 'Printer not found', padahal printer nyala." },
      { from: "ai", text: "Coba restart print spooler di Windows lalu cetak ulang dari menu Riwayat Pembayaran." },
    ],
    ai: { confidence: 45, kbTitle: "Troubleshooting Cetak Kwitansi" },
  },
  {
    id: "#A49C9555",
    title: "Hasil lab belum muncul di layar dokter padahal sudah selesai",
    requester: "Rizky Darmawan",
    source: "WhatsApp",
    module: { name: "Laboratorium", color: "#3b82f6" },
    status: "open",
    priority: "critical",
    mine: false,
    breached: true,
    sla: [{ label: "Resolusi", text: "Lewat 30j 7m", tone: "breached" }],
    messages: [
      { from: "user", text: "Hasil lab pasien sudah final tapi belum tampil di modul dokter." },
    ],
    ai: null,
  },
  {
    id: "#B72F1A03",
    title: "Stok obat tidak sinkron antar depo",
    requester: "Ayu Lestari",
    source: "Web",
    module: { name: "Farmasi", color: "#eab308" },
    status: "in_progress",
    priority: "medium",
    mine: true,
    breached: false,
    sla: [{ label: "Resolusi", text: "2j sisa", tone: "warning" }],
    messages: [
      { from: "user", text: "Jumlah stok di depo rawat inap beda dengan gudang utama." },
      { from: "ai", text: "Sinkronisasi terjadwal tiap 15 menit. Berikut cara memicu sinkron manual…" },
    ],
    ai: { confidence: 78, kbTitle: "Sinkronisasi Stok Farmasi" },
  },
  {
    id: "#C19D4E22",
    title: "Gambar radiologi gagal upload ke PACS",
    requester: "Doni Pratama",
    source: "Email",
    module: { name: "Radiologi", color: "#a855f7" },
    status: "open",
    priority: "medium",
    mine: false,
    breached: false,
    sla: [{ label: "Resolusi", text: "5j sisa", tone: "safe" }],
    messages: [
      { from: "user", text: "Upload citra CT selalu gagal di 80%." },
    ],
    ai: { confidence: 82, kbTitle: "Upload Citra Radiologi (PACS)" },
  },
  {
    id: "#E55A8B71",
    title: "Tagihan pasien BPJS terhitung dobel",
    requester: "Sari Wijaya",
    source: "WhatsApp",
    module: { name: "Billing", color: "#f97316" },
    status: "resolved",
    priority: "critical",
    mine: true,
    breached: false,
    sla: [{ label: "Resolusi", text: "selesai", tone: "safe" }],
    messages: [
      { from: "user", text: "Satu tindakan ditagih dua kali pada klaim BPJS." },
      { from: "ai", text: "Sudah dikoreksi oleh tim billing. Klaim diperbarui dan dikirim ulang." },
    ],
    ai: { confidence: 88, kbTitle: "Koreksi Klaim BPJS Dobel" },
  },
];

const FILTERS = [
  { id: "all", label: "Semua Tiket" },
  { id: "mine", label: "Saya" },
  { id: "critical", label: "Kritis" },
  { id: "breached", label: "SLA Lewat" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"] | `module:${string}`;

const STATUS_STYLE: Record<Status, string> = {
  open: "border-sky-200/70 bg-sky-50 text-sky-700",
  in_progress: "border-violet-200/70 bg-violet-50 text-violet-700",
  resolved: "border-emerald-200/70 bg-emerald-50 text-emerald-700",
};
const STATUS_LABEL: Record<Status, string> = {
  open: "Terbuka",
  in_progress: "Dikerjakan",
  resolved: "Selesai",
};
const STATUS_ICON = {
  open: RiCircleLine,
  in_progress: RiProgress3Line,
  resolved: RiCheckboxCircleLine,
} as const;

const SLA_TONE = {
  safe: "border-green-200/50 bg-green-50 text-green-600",
  warning: "border-yellow-200/50 bg-yellow-50 text-yellow-600",
  breached: "border-red-200/50 bg-red-50 text-red-500",
} as const;

function matchesFilter(t: Ticket, filter: FilterId): boolean {
  if (filter === "all") return true;
  if (filter === "mine") return t.mine;
  if (filter === "critical") return t.priority === "critical";
  if (filter === "breached") return t.breached;
  if (filter.startsWith("module:")) return t.module.name === filter.slice(7);
  return true;
}

export function ProductPreview() {
  const [filter, setFilter] = useState<FilterId>("all");
  const [selectedId, setSelectedId] = useState<string>(TICKETS[0].id);

  const filtered = TICKETS.filter((t) => matchesFilter(t, filter));
  const selected =
    filtered.find((t) => t.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background text-left shadow-2xl shadow-zinc-900/10 ring-1 ring-zinc-900/5">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-red-400/70" />
        <span className="size-2.5 rounded-full bg-yellow-400/70" />
        <span className="size-2.5 rounded-full bg-green-400/70" />
        <div className="ml-3 hidden flex-1 items-center gap-2 rounded-md bg-background px-3 py-1 text-[11px] text-muted-foreground sm:flex">
          <RiSearchLine className="size-3" />
          app.salamdesk.com/app/tickets
        </div>
      </div>

      <div className="grid h-[640px] grid-cols-1 md:grid-cols-[170px_minmax(0,1fr)] lg:grid-cols-[170px_300px_minmax(0,1fr)]">
        {/* Sidebar */}
        <aside className="hidden flex-col gap-0.5 border-r border-border bg-sidebar p-3 md:flex">
          <div className="mb-3 flex items-center gap-2 px-1">
            <img src="/android-chrome-512x512.png" alt="" className="size-5 rounded-md" />
            <span className="text-xs font-bold tracking-tight">SalamDesk</span>
          </div>
          {FILTERS.map((f) => (
            <NavButton
              key={f.id}
              label={f.label}
              active={filter === f.id}
              onClick={() => setFilter(f.id)}
            />
          ))}
          <p className="mt-3 mb-1 px-1 font-heading text-[9px] uppercase tracking-wider text-muted-foreground">
            Modul SIMRS
          </p>
          {MODULES.map((m) => (
            <NavButton
              key={m.id}
              label={m.name}
              color={m.color}
              active={filter === `module:${m.name}`}
              onClick={() => setFilter(`module:${m.name}`)}
            />
          ))}
        </aside>

        {/* Ticket list */}
        <section className="hidden min-h-0 flex-col border-r border-border lg:flex">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-bold">
              {FILTERS.find((f) => f.id === filter)?.label ??
                (typeof filter === "string" && filter.startsWith("module:")
                  ? filter.slice(7)
                  : "Inbox")}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {filtered.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                <RiInboxLine className="size-6 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">Tidak ada tiket di tampilan ini.</p>
              </div>
            ) : (
              filtered.map((t) => (
                <TicketCard
                  key={t.id}
                  ticket={t}
                  selected={selected?.id === t.id}
                  onClick={() => setSelectedId(t.id)}
                />
              ))
            )}
          </div>
        </section>

        {/* Detail */}
        <section className="flex min-h-0 flex-col bg-background">
          {selected ? (
            <>
              <div className="shrink-0 border-b border-border px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground/75">{selected.id}</span>
                  <span className="text-border">/</span>
                  <span className="flex items-center gap-1">
                    <RiInboxLine className="size-3" /> {selected.source}
                  </span>
                </div>
                <h3 className="mt-1.5 text-pretty text-lg font-bold leading-tight tracking-tight">
                  {selected.title}
                </h3>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <StatusPill status={selected.status} />
                  <span
                    className={`inline-flex rounded border px-2.5 py-1 text-[11px] font-medium ${
                      selected.priority === "critical"
                        ? "border-red-200/70 bg-red-50 text-red-700"
                        : "border-orange-200/70 bg-orange-50 text-orange-700"
                    }`}
                  >
                    {selected.priority === "critical" ? "Kritis" : "Normal"}
                  </span>
                  {selected.sla.map((s) => (
                    <span
                      key={s.label}
                      className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium ${SLA_TONE[s.tone]}`}
                    >
                      <RiTimerLine className="size-3" /> {s.label}: {s.text}
                    </span>
                  ))}
                </div>
              </div>

              {/* Conversation */}
              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {selected.messages.map((m, i) => (
                  <div key={i} className={m.from === "ai" ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={
                        m.from === "ai"
                          ? "max-w-[80%] rounded-2xl rounded-tr-sm bg-primary/10 px-3.5 py-2 text-xs leading-relaxed text-foreground"
                          : "max-w-[80%] rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2 text-xs text-foreground"
                      }
                    >
                      {m.text}
                    </div>
                  </div>
                ))}

                {selected.ai && (
                  <div className="overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 shadow-sm">
                    <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                      <span className="flex size-6 items-center justify-center rounded-full bg-amber-400/20">
                        <RiSparklingLine className="size-3.5 text-amber-600" />
                      </span>
                      <span className="text-xs font-semibold text-amber-900">Saran AI</span>
                      <span className="text-[11px] font-medium text-amber-700">
                        {selected.ai.confidence}% yakin
                      </span>
                    </div>
                    <div className="border-t border-amber-200/70 px-3.5 py-2.5">
                      <p className="text-[11px] font-medium text-amber-700">Artikel KB yang relevan:</p>
                      <p className="text-xs font-medium text-amber-900">{selected.ai.kbTitle}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Reply box */}
              <div className="shrink-0 border-t border-border px-5 py-3">
                <div className="mb-2 flex items-center justify-between text-[10px] font-medium text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <RiLockLine className="size-3" /> Catatan Internal
                  </span>
                  <span className="inline-flex items-center gap-1 text-amber-600">
                    <RiSparklingLine className="size-3" /> Draf AI
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                  <RiAttachment2 className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-xs text-muted-foreground">
                    Tulis balasan untuk {selected.requester}…
                  </span>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <RiSendPlaneFill className="size-3.5" />
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
              <RiInboxLine className="size-7 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Pilih tiket untuk melihat detail.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function NavButton({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active?: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] font-medium transition-colors ${
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
    >
      {color && <span className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: color }} />}
      <span className="truncate">{label}</span>
    </button>
  );
}

function StatusPill({ status }: { status: Status }) {
  const Icon = STATUS_ICON[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${STATUS_STYLE[status]}`}
    >
      <Icon className="size-3" />
      {STATUS_LABEL[status]}
    </span>
  );
}

function TicketCard({
  ticket,
  selected,
  onClick,
}: {
  ticket: Ticket;
  selected?: boolean;
  onClick: () => void;
}) {
  const Icon = STATUS_ICON[ticket.status];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full border-b border-l-4 p-3.5 text-left transition-colors ${
        selected
          ? "border-l-primary bg-muted/25"
          : "border-l-transparent hover:bg-muted/40"
      }`}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
          {ticket.id}
          <RiInboxLine className="size-3" />
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLE[ticket.status]}`}
        >
          <Icon className="size-2.5" />
          {STATUS_LABEL[ticket.status]}
        </span>
      </div>
      <h4 className="mb-2 line-clamp-1 text-xs font-semibold leading-snug">{ticket.title}</h4>
      <div className="mb-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <RiUserLine className="size-3" /> {ticket.requester}
        </span>
        <span className="flex items-center gap-1 font-medium">
          <span className="size-1.5 rounded-sm" style={{ backgroundColor: ticket.module.color }} />
          {ticket.module.name}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span
          className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium ${
            ticket.priority === "critical"
              ? "border-red-200/70 bg-red-50 text-red-700"
              : "border-orange-200/70 bg-orange-50 text-orange-700"
          }`}
        >
          {ticket.priority === "critical" ? "Kritis" : "Normal"}
        </span>
        {ticket.sla[0] && (
          <span
            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${SLA_TONE[ticket.sla[0].tone]}`}
          >
            <RiTimerLine className="size-2.5" /> {ticket.sla[0].label}: {ticket.sla[0].text}
          </span>
        )}
      </div>
    </button>
  );
}
