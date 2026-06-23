"use client";

import { QRCodeSVG } from "qrcode.react";

/**
 * The "scan to try" corner. Encodes a wa.me deep link so a visitor can open
 * WhatsApp pre-addressed to the demo number (and optionally a pre-filled
 * message) and watch their own conversation flow across the wall.
 */
export function QrCorner({ waLink }: { waLink: string | null }) {
  if (!waLink) return null;
  return (
    <div className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="rounded-lg border border-zinc-200 bg-white p-2">
        <QRCodeSVG value={waLink} size={96} level="M" />
      </div>
      <div>
        <p className="text-sm font-semibold text-zinc-900">Coba langsung 👋</p>
        <p className="mt-1 max-w-[14rem] text-xs text-zinc-500">
          Pindai untuk chat asisten kami di WhatsApp — lihat pesanmu diproses di
          layar ini secara langsung.
        </p>
      </div>
    </div>
  );
}
