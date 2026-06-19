"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  RiWhatsappLine,
  RiLoader4Line,
  RiCheckDoubleLine,
  RiErrorWarningLine,
  RiLogoutBoxRLine,
  RiTicket2Line,
  RiInboxLine,
  RiUser3Line,
  RiChat3Line,
  RiTimeLine,
  RiArrowRightLine,
  RiFileCopyLine,
  RiCheckLine,
  RiSmartphoneLine,
  RiQrCodeLine,
} from "@remixicon/react";
import { PageContainer, PageHeader } from "@/components/page-shell";

interface WaAccount {
  number: string;
  name: string | null;
}

interface WaStats {
  ticketsTotal: number;
  ticketsOpen: number;
  ticketsToday: number;
  contacts: number;
  messagesToday: number;
  lastInboundAt: string | null;
}

/** "08123456789" → "+62 812-3456-789"-ish grouping for readability. */
function formatNumber(raw: string): string {
  if (!raw) return "—";
  const digits = raw.replace(/\D/g, "");
  const groups = digits.match(/.{1,4}/g) ?? [digits];
  return `+${groups.join(" ")}`;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "Belum ada";
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

function formatUptime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}j ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}h ${hours % 24}j`;
}

export default function WhatsAppConnectionPage() {
  const [status, setStatus] = useState<string>("connecting");
  const [qr, setQr] = useState<string | null>(null);
  const [account, setAccount] = useState<WaAccount | null>(null);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [stats, setStats] = useState<WaStats | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  const handleCopy = async () => {
    if (!account?.number) return;
    try {
      await navigator.clipboard.writeText(account.number);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setDisconnectError(null);
    try {
      const res = await fetch("/api/whatsapp/disconnect", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setDisconnectError(data?.error ?? "Gagal memutuskan koneksi.");
        return;
      }
      setStatus("connecting");
      setQr(null);
      setAccount(null);
      setConnectedAt(null);
      setConfirmingDisconnect(false);
    } catch {
      setDisconnectError("Gagal menghubungi server.");
    } finally {
      setDisconnecting(false);
    }
  };

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/whatsapp/status");
        if (!res.ok) return;
        const data = await res.json();
        setStatus(data.status);
        setQr(data.qr ?? null);
        setAccount(data.account ?? null);
        setConnectedAt(data.connectedAt ?? null);
      } catch (err) {
        console.error("Failed to fetch WA status:", err);
      }
    };

    fetchStatus();
    // Poll fast only while linking (QR rotates); once connected the status
    // rarely changes, so back off to cut Redis commands (Upstash bills per call).
    const intervalMs = status === "connected" ? 30_000 : 5_000;
    const interval = setInterval(fetchStatus, intervalMs);
    return () => clearInterval(interval);
  }, [status]);

  // Pull live ticket/contact stats only while connected.
  useEffect(() => {
    if (status !== "connected") {
      setStats(null);
      return;
    }
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/whatsapp/stats");
        if (!res.ok) return;
        setStats(await res.json());
      } catch (err) {
        console.error("Failed to fetch WA stats:", err);
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 15_000);
    return () => clearInterval(interval);
  }, [status]);

  // -------------------------------------------------------------------------
  // Connected → live dashboard
  // -------------------------------------------------------------------------
  if (status === "connected") {
    return (
      <PageContainer>
        <PageHeader
          icon={<RiWhatsappLine className="size-5" />}
          title="WhatsApp"
          description="Status koneksi dan ringkasan aktivitas nomor WhatsApp yang terhubung."
        />
        {/* Account header */}
        <Card className="overflow-hidden border-border/60">
          <div className="h-1.5 w-full bg-gradient-to-r from-green-500 via-emerald-400 to-green-500" />
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100">
                <RiWhatsappLine className="h-8 w-8 text-green-600" />
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-green-500">
                    <RiCheckLine className="h-2.5 w-2.5 text-white" />
                  </span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold leading-tight">
                    {account?.name || "WhatsApp Business"}
                  </h2>
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                    Terhubung
                  </Badge>
                </div>
                <button
                  onClick={handleCopy}
                  className="group mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <RiSmartphoneLine className="h-3.5 w-3.5" />
                  <span className="font-medium tabular-nums">{formatNumber(account?.number ?? "")}</span>
                  {copied ? (
                    <RiCheckLine className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <RiFileCopyLine className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                  <RiTimeLine className="h-3.5 w-3.5" /> Uptime sesi
                </p>
                <p className="mt-0.5 font-semibold tabular-nums">{formatUptime(connectedAt)}</p>
              </div>
              {confirmingDisconnect ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmingDisconnect(false)}
                    disabled={disconnecting}
                  >
                    Batal
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                  >
                    {disconnecting ? (
                      <RiLoader4Line className="size-4 animate-spin" />
                    ) : (
                      <RiLogoutBoxRLine className="size-4" />
                    )}
                    Putuskan
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setConfirmingDisconnect(true)}
                >
                  <RiLogoutBoxRLine className="size-4" />
                  Putuskan
                </Button>
              )}
            </div>
          </CardContent>
          {(confirmingDisconnect || disconnectError) && (
            <div className="border-t bg-muted/30 px-6 py-3">
              {confirmingDisconnect && (
                <p className="text-sm text-muted-foreground">
                  Memutuskan koneksi melepas tautan perangkat ini. Anda perlu memindai QR Code lagi
                  untuk menghubungkan kembali.
                </p>
              )}
              {disconnectError && <p className="text-sm text-red-600">{disconnectError}</p>}
            </div>
          )}
        </Card>

        {/* Live stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={<RiChat3Line className="h-5 w-5" />}
            label="Pesan masuk hari ini"
            value={stats?.messagesToday}
            accent="text-green-600 bg-green-50"
          />
          <StatCard
            icon={<RiInboxLine className="h-5 w-5" />}
            label="Tiket aktif"
            value={stats?.ticketsOpen}
            accent="text-amber-600 bg-amber-50"
          />
          <StatCard
            icon={<RiTicket2Line className="h-5 w-5" />}
            label="Tiket hari ini"
            value={stats?.ticketsToday}
            accent="text-blue-600 bg-blue-50"
          />
          <StatCard
            icon={<RiUser3Line className="h-5 w-5" />}
            label="Total kontak"
            value={stats?.contacts}
            accent="text-violet-600 bg-violet-50"
          />
        </div>

        {/* Secondary panel: activity + actions */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ringkasan channel</CardTitle>
              <CardDescription>Aktivitas tiket dari WhatsApp.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <Row
                label="Pesan terakhir diterima"
                value={formatRelative(stats?.lastInboundAt ?? null)}
                icon={<RiTimeLine className="h-4 w-4 text-muted-foreground" />}
              />
              <Separator />
              <Row
                label="Total tiket dari WhatsApp"
                value={stats?.ticketsTotal != null ? `${stats.ticketsTotal} tiket` : "—"}
                icon={<RiTicket2Line className="h-4 w-4 text-muted-foreground" />}
              />
              <Separator />
              <Row
                label="Terhubung sejak"
                value={
                  connectedAt
                    ? new Date(connectedAt).toLocaleString("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "—"
                }
                icon={<RiCheckDoubleLine className="h-4 w-4 text-green-600" />}
              />
            </CardContent>
          </Card>

          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Aksi cepat</CardTitle>
              <CardDescription>Kelola tiket WhatsApp.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-2">
              <Button asChild variant="outline" className="justify-between">
                <Link href="/app/tickets">
                  <span className="flex items-center gap-2">
                    <RiInboxLine className="h-4 w-4" /> Lihat tiket
                  </span>
                  <RiArrowRightLine className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-between">
                <Link href="/app/dashboard">
                  <span className="flex items-center gap-2">
                    <RiTicket2Line className="h-4 w-4" /> Buka dashboard
                  </span>
                  <RiArrowRightLine className="h-4 w-4" />
                </Link>
              </Button>
              <p className="mt-auto pt-2 text-xs text-muted-foreground/70">
                Pesan WhatsApp masuk otomatis menjadi tiket dan bisa dibalas dari halaman tiket.
              </p>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    );
  }

  // -------------------------------------------------------------------------
  // QR / connecting / logged-out → centered linking card
  // -------------------------------------------------------------------------
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-muted/20 p-6">
      <Card className="w-full max-w-md border-border/50 shadow-md">
        <CardHeader className="pb-2 text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <RiWhatsappLine className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl">WhatsApp Connection</CardTitle>
          <CardDescription>
            Hubungkan nomor WhatsApp untuk menerima dan membalas tiket secara otomatis.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-[300px] flex-col items-center justify-center pb-8 pt-6">
          {status === "qr" && qr ? (
            <div className="flex w-full animate-in flex-col items-center gap-5 duration-300 fade-in">
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <QRCodeSVG value={qr} size={220} />
              </div>
              <div className="w-full space-y-2.5">
                <Step n={1} text="Buka WhatsApp di HP Anda" />
                <Step n={2} text="Ketuk Menu › Perangkat Tertaut" />
                <Step n={3} text="Ketuk Tautkan Perangkat, lalu pindai kode ini" />
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                <RiQrCodeLine className="h-3.5 w-3.5" /> Kode menyegar otomatis setiap beberapa detik.
              </p>
            </div>
          ) : status === "logged_out" ? (
            <div className="flex animate-in flex-col items-center space-y-4 text-center duration-300 fade-in zoom-in">
              <div className="rounded-full bg-red-100 p-4">
                <RiErrorWarningLine className="h-12 w-12 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-700">Sesi Berakhir</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Anda telah keluar. Silakan hapus folder{" "}
                  <code className="rounded border border-red-200 bg-red-50 px-1 py-0.5 text-red-800">
                    ./wa_auth
                  </code>{" "}
                  di server dan restart worker.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4 text-center">
              <RiLoader4Line className="h-10 w-10 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Menunggu worker...</p>
              <p className="max-w-[250px] text-xs text-muted-foreground/70">
                Pastikan worker berjalan dengan perintah{" "}
                <code className="rounded bg-muted px-1 py-0.5">bun run worker</code>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | undefined;
  accent: string;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="flex flex-col gap-3 p-5">
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", accent)}>{icon}</div>
        <div>
          <p className="text-2xl font-bold tabular-nums leading-none">
            {value != null ? value : <span className="text-muted-foreground/40">—</span>}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-600 text-xs font-semibold text-white">
        {n}
      </span>
      <span className="text-sm text-foreground/80">{text}</span>
    </div>
  );
}
