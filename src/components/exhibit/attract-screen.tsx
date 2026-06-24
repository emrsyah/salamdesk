"use client";

import { QRCodeSVG } from "qrcode.react";
import { motion } from "motion/react";
import { RiShieldCheckLine, RiWhatsappLine } from "@remixicon/react";

const STEPS = [
  { n: "1", title: "Pindai kode QR", detail: "Buka kamera, arahkan ke sini" },
  { n: "2", title: "Kirim pesan WhatsApp", detail: "Pesan sudah disiapkan — tinggal kirim" },
  { n: "3", title: "Lihat diri Anda di layar", detail: "AI menjawab Anda secara langsung" },
];

/**
 * Idle/attract hero — the wall when no tickets are in flight. Built in the
 * marketing language of the landing page (sky atmosphere lives on the page
 * behind this) so the booth reads as "the landing page, alive". A two-column
 * hero fills the wide wall rather than floating in a void.
 */
export function AttractScreen({ waLink }: { waLink: string | null }) {
  return (
    <div className="flex min-h-full items-center justify-center px-5 py-8 sm:px-12 sm:py-10">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10"
      >
        {/* Left — message */}
        <div className="text-left">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 font-heading text-[11px] uppercase tracking-wider text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" />
            AI Helpdesk untuk SIMRS &amp; Rumah Sakit
          </span>

          <h1 className="mt-4 max-w-xl text-balance text-3xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-4xl xl:text-5xl">
            AI yang menjawab keluhan WhatsApp Anda dalam{" "}
            <span className="text-primary">hitungan detik</span>
          </h1>

          <p className="mt-3 max-w-lg text-pretty text-lg font-medium leading-snug text-foreground/80 xl:text-xl">
            Coba sendiri sekarang — pindai, kirim pesan, dan lihat agen kami
            bekerja langsung di layar ini.
          </p>

          <div className="mt-6 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.12 }}
                className="rounded-2xl border border-border bg-background/70 p-4 shadow-sm backdrop-blur-sm"
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-primary font-heading text-xs font-bold text-primary-foreground">
                  {s.n}
                </span>
                <p className="mt-2 text-sm font-semibold text-foreground">{s.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.detail}</p>
              </motion.div>
            ))}
          </div>

          <p className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <RiShieldCheckLine className="size-4 text-primary" />
              Dirancang untuk alur kerja ITSM rumah sakit
            </span>
            <span className="inline-flex items-center gap-1.5">
              <RiWhatsappLine className="size-4 text-primary" />
              Terintegrasi WhatsApp
            </span>
          </p>
        </div>

        {/* Right — the scan target */}
        {waLink && (
          <div className="flex flex-col items-center">
            <motion.div
              animate={{ scale: [1, 1.025, 1] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
              className="rounded-3xl border border-border bg-white p-5 shadow-xl"
            >
              <QRCodeSVG value={waLink} size={224} level="M" />
            </motion.div>
            <p className="mt-4 inline-flex items-center gap-2 font-heading text-sm font-semibold text-foreground">
              <RiWhatsappLine className="size-4 text-primary" />
              Pindai untuk mulai 👋
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
