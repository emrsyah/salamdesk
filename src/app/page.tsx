import Link from "next/link";
import { redirect } from "next/navigation";
import {
  RiSparklingLine,
  RiTimerLine,
  RiLayoutGridLine,
  RiWhatsappLine,
  RiBookOpenLine,
  RiBarChartBoxLine,
  RiArrowRightLine,
  RiShieldCheckLine,
  RiCheckLine,
} from "@remixicon/react";
import { getSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/landing/site-header";
import { ProductPreview } from "@/components/landing/product-preview";

const FEATURES = [
  {
    icon: RiSparklingLine,
    title: "Balasan Otomatis AI",
    desc: "AI mengklasifikasi setiap tiket, mencari artikel Knowledge Base yang relevan, lalu menyarankan atau langsung mengirim balasan — lengkap dengan skor keyakinan.",
  },
  {
    icon: RiTimerLine,
    title: "SLA Terpantau Real-time",
    desc: "Target respons dan resolusi dipantau terus-menerus. Tiket yang mendekati batas dieskalasi otomatis sebelum terlambat.",
  },
  {
    icon: RiLayoutGridLine,
    title: "Multi-Modul SIMRS",
    desc: "Billing, Farmasi, Laboratorium, Radiologi, Rawat Inap & Jalan, Rekam Medis — setiap modul punya antrean dan rutenya sendiri.",
  },
  {
    icon: RiWhatsappLine,
    title: "Inbox Omnichannel",
    desc: "WhatsApp, web, dan email menyatu jadi satu antrean. Pelapor membalas dari mana saja, tim Anda menjawab dari satu tempat.",
  },
  {
    icon: RiBookOpenLine,
    title: "Knowledge Base Hidup",
    desc: "Artikel internal menjadi sumber jawaban AI yang konsisten — dan setiap tiket yang selesai memperkaya basis pengetahuan.",
  },
  {
    icon: RiBarChartBoxLine,
    title: "Analitik Operasional",
    desc: "Dashboard real-time untuk beban tim, tren tiket, dan performa SLA. Putuskan berdasarkan data, bukan tebakan.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Tiket masuk dari mana saja",
    desc: "Pasien atau staf melapor lewat WhatsApp, web, atau email. SalamDesk menyatukannya jadi satu antrean.",
  },
  {
    n: "02",
    title: "AI memilah & menjawab",
    desc: "AI menentukan modul, prioritas, dan menyarankan balasan dari Knowledge Base — banyak tiket selesai tanpa sentuhan manusia.",
  },
  {
    n: "03",
    title: "Tim fokus yang penting",
    desc: "Kasus yang butuh manusia dirutekan ke staf yang tepat dengan SLA yang terjaga. Sisanya berjalan otomatis.",
  },
];

export default async function LandingPage() {
  const session = await getSession();
  if (session?.user) redirect("/app/tickets");

  return (
    <div className="min-h-svh bg-background text-foreground">
      <SiteHeader />

      <main>
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section id="produk" className="relative overflow-hidden">
          {/* dotted grid texture, masked to fade toward the edges */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              backgroundImage:
                "radial-gradient(var(--border) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
              maskImage:
                "radial-gradient(ellipse 80% 55% at 50% 35%, black 35%, transparent 75%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 80% 55% at 50% 35%, black 35%, transparent 75%)",
            }}
          />
          {/* warm ambient glow */}
          <div className="pointer-events-none absolute -top-32 left-1/2 -z-10 size-[720px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
          <div className="pointer-events-none absolute right-[8%] top-24 -z-10 size-72 rounded-full bg-amber-300/20 blur-3xl" />
          <div className="pointer-events-none absolute left-[6%] top-40 -z-10 size-64 rounded-full bg-sky-300/10 blur-3xl" />

          <div className="mx-auto max-w-6xl px-6 pt-16 pb-12 sm:pt-24">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 font-heading text-[11px] uppercase tracking-wider text-muted-foreground">
                <span className="size-1.5 rounded-full bg-primary" />
                AI Helpdesk untuk SIMRS &amp; Rumah Sakit
              </span>

              <h1 className="mx-auto mt-6 max-w-3xl text-balance text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
                Helpdesk cerdas untuk operasional rumah sakit.
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-balance text-xl font-medium leading-snug text-muted-foreground sm:text-2xl">
                AI menjawab, SLA terpantau, semua modul dalam satu inbox.
              </p>

              <p className="mx-auto mt-6 max-w-xl text-pretty text-base text-muted-foreground">
                SalamDesk menyatukan tiket dari WhatsApp, web, dan email — lalu AI
                mengklasifikasi, menyarankan jawaban, dan menjaga SLA agar tim Anda
                fokus pada pasien, bukan antrean.
              </p>

              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 px-6 text-base font-semibold">
                  <Link href="/sign-in">
                    Coba SalamDesk
                    <RiArrowRightLine className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
                  <Link href="#kontak">Jadwalkan Demo</Link>
                </Button>
              </div>

              <p className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
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

            {/* Product showcase */}
            <div className="relative mx-auto mt-16 max-w-6xl">
              <div className="pointer-events-none absolute -inset-x-8 -bottom-8 top-12 -z-10 rounded-[2rem] bg-gradient-to-b from-primary/10 to-transparent blur-2xl" />
              <ProductPreview />
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Demo interaktif — klik menu &amp; tiket untuk menjelajah.
              </p>
            </div>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────── */}
        <section id="fitur" className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-heading text-[11px] uppercase tracking-wider text-primary">
              Satu platform
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Semua yang dibutuhkan helpdesk modern
            </h2>
            <p className="mt-4 text-muted-foreground">
              Dari triase otomatis sampai analitik SLA — dirancang untuk kompleksitas
              operasional rumah sakit.
            </p>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/40 hover:bg-muted/30"
              >
                <span className="inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── How it works ────────────────────────────────────── */}
        <section id="cara-kerja" className="border-y border-border bg-muted/30">
          <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
            <div className="mx-auto max-w-2xl text-center">
              <p className="font-heading text-[11px] uppercase tracking-wider text-primary">
                Cara kerja
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Dari laporan ke selesai, sebagian besar otomatis
              </h2>
            </div>

            <div className="mt-14 grid gap-8 md:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.n} className="relative">
                  <span className="font-heading text-4xl font-bold text-primary/30">
                    {s.n}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────────────── */}
        <section id="kontak" className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-zinc-950 px-8 py-16 text-center text-white sm:px-16">
            <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/30 to-transparent" />
            <div className="pointer-events-none absolute -left-32 -top-32 size-80 rounded-full bg-primary/20 blur-3xl" />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Siap mengubah cara tim Anda menangani tiket?
              </h2>
              <p className="mt-4 text-zinc-300">
                Masuk untuk mulai, atau jadwalkan demo bersama tim kami untuk melihat
                SalamDesk berjalan di alur kerja rumah sakit Anda.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 px-6 text-base font-semibold">
                  <Link href="/sign-in">
                    Coba SalamDesk
                    <RiArrowRightLine className="size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 border-white/20 bg-white/10 px-6 text-base text-white hover:bg-white/20 hover:text-white"
                >
                  <Link href="/sign-in">Jadwalkan Demo</Link>
                </Button>
              </div>
              <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-zinc-300">
                {["Setup cepat", "Bahasa Indonesia", "Didukung AI"].map((item) => (
                  <li key={item} className="inline-flex items-center gap-1.5">
                    <RiCheckLine className="size-4 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <img src="/android-chrome-512x512.png" alt="SalamDesk" className="size-7 rounded-lg" />
            <span className="font-bold tracking-tight">SalamDesk</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} SalamDesk. Seluruh hak cipta dilindungi.
          </p>
          <div className="flex items-center gap-5 text-sm text-muted-foreground">
            <Link href="/sign-in" className="transition-colors hover:text-foreground">
              Masuk
            </Link>
            <a href="#fitur" className="transition-colors hover:text-foreground">
              Fitur
            </a>
            <a href="#kontak" className="transition-colors hover:text-foreground">
              Kontak
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
