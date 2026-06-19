"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RiErrorWarningLine, RiArrowRightLine } from "@remixicon/react";

/**
 * Global banner shown across the app whenever no WhatsApp session is connected.
 * Inbound messages won't become tickets until a number is linked, so we surface
 * a persistent prompt with a shortcut to the connection page.
 */
export function WaSessionBanner() {
  const pathname = usePathname();
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/whatsapp/status");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setConnected(data.status === "connected");
      } catch {
        /* network hiccup — keep last known state */
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 15_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Don't show until we know it's disconnected, and never on the WA page itself
  // (which already shows full connection UI).
  if (connected !== false) return null;
  if (pathname?.startsWith("/app/whatsapp")) return null;

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
      <div className="flex items-center gap-2 text-sm">
        <RiErrorWarningLine className="size-4 shrink-0" />
        <span>
          <span className="font-medium">WhatsApp belum terhubung.</span>{" "}
          <span className="text-amber-800/80 dark:text-amber-200/70">
            Pesan masuk tidak akan otomatis menjadi tiket sampai nomor dihubungkan.
          </span>
        </span>
      </div>
      <Link
        href="/app/whatsapp"
        className="flex shrink-0 items-center gap-1 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700"
      >
        Hubungkan
        <RiArrowRightLine className="size-3.5" />
      </Link>
    </div>
  );
}
