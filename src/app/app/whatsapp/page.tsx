"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RiWhatsappLine, RiLoader4Line, RiCheckDoubleLine, RiErrorWarningLine, RiLogoutBoxRLine } from "@remixicon/react";

export default function WhatsAppConnectionPage() {
  const [status, setStatus] = useState<string>("connecting");
  const [qr, setQr] = useState<string | null>(null);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

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
      // The polling effect will pick up the new status from the worker.
      setStatus("connecting");
      setQr(null);
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
        if (data.qr) {
          setQr(data.qr);
        }
      } catch (err) {
        console.error("Failed to fetch WA status:", err);
      }
    };

    fetchStatus(); // initial fetch
    const interval = setInterval(fetchStatus, 3000); // poll every 3 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-1 flex-col p-6 items-center justify-center bg-muted/20">
      <Card className="w-full max-w-md shadow-md border-border/50">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto bg-green-100 p-3 rounded-full w-14 h-14 flex items-center justify-center mb-2">
            <RiWhatsappLine className="w-8 h-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl">WhatsApp Connection</CardTitle>
          <CardDescription>
            Hubungkan nomor WhatsApp untuk menerima dan membalas tiket secara otomatis.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center pt-6 pb-8 min-h-[300px]">
          {status === "connected" ? (
            <div className="flex flex-col items-center text-center space-y-4 animate-in fade-in zoom-in duration-300">
              <div className="bg-green-100 p-4 rounded-full">
                <RiCheckDoubleLine className="w-12 h-12 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-green-700">Terhubung</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  WhatsApp sudah berhasil terhubung dan siap digunakan.
                </p>
              </div>

              {confirmingDisconnect ? (
                <div className="flex flex-col items-center gap-3 pt-2">
                  <p className="text-sm text-muted-foreground max-w-[260px]">
                    Memutuskan koneksi akan melepas tautan perangkat ini. Anda perlu
                    memindai QR Code lagi untuk menghubungkan kembali. Lanjutkan?
                  </p>
                  <div className="flex gap-2">
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
                      Ya, putuskan
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  onClick={() => setConfirmingDisconnect(true)}
                >
                  <RiLogoutBoxRLine className="size-4" />
                  Putuskan Koneksi
                </Button>
              )}

              {disconnectError && (
                <p className="text-sm text-red-600">{disconnectError}</p>
              )}
            </div>
          ) : status === "qr" && qr ? (
            <div className="flex flex-col items-center space-y-6 animate-in fade-in duration-300">
              <div className="bg-white p-4 rounded-xl border shadow-sm">
                <QRCodeSVG value={qr} size={220} />
              </div>
              <p className="text-sm text-center text-muted-foreground">
                Buka WhatsApp di HP Anda &gt; Perangkat Tertaut &gt; Tautkan Perangkat. Scan QR Code di atas.
              </p>
            </div>
          ) : status === "logged_out" ? (
            <div className="flex flex-col items-center text-center space-y-4 animate-in fade-in zoom-in duration-300">
              <div className="bg-red-100 p-4 rounded-full">
                <RiErrorWarningLine className="w-12 h-12 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-700">Sesi Berakhir</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  Anda telah keluar. Silakan hapus folder <code className="bg-red-50 px-1 py-0.5 rounded text-red-800 border border-red-200">./wa_auth</code> di server dan restart worker.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4 text-center">
              <RiLoader4Line className="w-10 h-10 text-muted-foreground animate-spin" />
              <p className="text-sm text-muted-foreground">Menunggu worker...</p>
              <p className="text-xs text-muted-foreground/70 max-w-[250px]">
                Pastikan worker berjalan dengan perintah <code className="bg-muted px-1 py-0.5 rounded">bun run worker</code>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
