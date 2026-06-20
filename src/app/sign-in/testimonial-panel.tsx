"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

const testimonials = [
  {
    quote:
      "Sejak pakai SalamDesk, tiket IT kami turun 40% karena AI langsung jawab pertanyaan berulang. Tim kami bisa fokus ke masalah yang benar-benar butuh perhatian.",
    name: "dr. Ratna Kusuma",
    role: "Kepala IT RSUD Banyumas",
  },
  {
    quote:
      "Integrasi WhatsApp-nya luar biasa. Staf kami cukup chat seperti biasa, tiket terbuat otomatis. SLA kami dari 48 jam turun jadi 6 jam rata-rata.",
    name: "Budi Santoso",
    role: "Manajer Operasional RSIA Permata",
  },
  {
    quote:
      "AI triage-nya akurat. Tiket kritis langsung eskalasi ke engineer yang tepat tanpa harus manual. Ini mengubah cara kerja helpdesk kami sepenuhnya.",
    name: "Siti Marlina",
    role: "Koordinator SIMRS RS Harapan Sehat",
  },
  {
    quote:
      "SalamDesk membantu tim kami di RSUD Karawang mengelola tiket SIMRS jauh lebih efisien. Respons lebih cepat, tidak ada lagi tiket yang terlewat.",
    name: "Pak Rahmat",
    role: "Manajer Evotek, RSUD Karawang",
  },
];

export function TestimonialPanel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const t = testimonials[index];

  return (
    <div
      className="hidden lg:flex flex-col justify-between w-1/2 relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url('/bg/6.png')" }}
    >
      {/* subtle overlay so text is readable */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Logo */}
      <Link
        href="/"
        className="relative z-10 flex items-center m-10 text-xl font-bold tracking-tight text-white drop-shadow"
      >
        <img
          src="/android-chrome-512x512.png"
          alt="SalamDesk Logo"
          className="mr-3 size-10 rounded-xl shadow-lg ring-1 ring-white/20"
        />
        SalamDesk
      </Link>

      {/* Testimonial */}
      <div className="relative z-10 mx-10 mb-16 space-y-4">
        {/* Fixed-height container prevents layout shift between short/long quotes */}
        <div className="relative h-56">
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.45, ease: "easeInOut" }}
              className="absolute inset-0 flex flex-col gap-4"
            >
              {/* Quote */}
              <blockquote className="text-2xl font-semibold leading-snug text-white drop-shadow-sm">
                &ldquo;{t.quote}&rdquo;
              </blockquote>

              {/* Person */}
              <div>
                <p className="text-sm font-semibold text-white">{t.name}</p>
                <p className="text-xs text-white/70">{t.role}</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dots */}
        <div className="flex gap-1.5">
          {testimonials.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index ? "w-6 bg-white" : "w-1.5 bg-white/40"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 px-10 pb-6 text-xs text-white/50">
        © {new Date().getFullYear()} SalamDesk. All rights reserved.
      </div>
    </div>
  );
}
