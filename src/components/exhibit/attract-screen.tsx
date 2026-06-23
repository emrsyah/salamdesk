"use client";

import { QRCodeSVG } from "qrcode.react";
import { motion } from "motion/react";

const STEPS = [
  { n: "1", icon: "📲", title: "Pindai kode QR", detail: "Buka kamera, arahkan ke sini" },
  { n: "2", icon: "💬", title: "Kirim pesan WhatsApp", detail: "Pesan sudah disiapkan — tinggal kirim" },
  { n: "3", icon: "👀", title: "Lihat diri Anda di layar", detail: "AI menjawab Anda secara langsung" },
];

/**
 * The attract loop shown when the wall is quiet — its job is to convert a
 * passer-by into someone who scans. Big value prop, a large QR, and a dead
 * simple 1-2-3 so anyone gets it in a glance.
 */
export function AttractScreen({ waLink }: { waLink: string | null }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-xl"
      >
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-fuchsia-400">
          SalamDesk
        </p>
        <h1 className="mt-3 text-balance text-4xl font-bold leading-tight text-zinc-50">
          AI yang menjawab keluhan WhatsApp Anda dalam{" "}
          <span className="text-amber-300">hitungan detik</span>
        </h1>
        <p className="mt-3 text-lg text-zinc-400">
          Coba sendiri sekarang — kirim pesan, lihat agen kami bekerja langsung
          di layar ini.
        </p>

        {waLink && (
          <motion.div
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            className="mt-8 inline-flex rounded-3xl bg-white p-4 shadow-2xl"
          >
            <QRCodeSVG value={waLink} size={208} level="M" />
          </motion.div>
        )}

        <div className="mt-8 grid grid-cols-3 gap-3 text-left">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.12 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-fuchsia-500/15 font-mono text-xs font-bold text-fuchsia-300">
                  {s.n}
                </span>
                <span className="text-lg">{s.icon}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-zinc-100">{s.title}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{s.detail}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
