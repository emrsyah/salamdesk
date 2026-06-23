import { HeaderBar } from "@/components/exhibit/header-bar";
import { LiveFeed } from "@/components/exhibit/live-feed";
import { PipelineTheater } from "@/components/exhibit/pipeline-theater";
import { StatsPanel } from "@/components/exhibit/stats-panel";
import { QrCorner } from "@/components/exhibit/qr-corner";
import { SpotlightOverlay } from "@/components/exhibit/spotlight-overlay";

// The wall is purely event-driven; nothing to prerender or cache.
export const dynamic = "force-dynamic";

/** Build the wa.me deep link for the QR corner from configured env. */
function buildWaLink(): string | null {
  const number = process.env.EXHIBIT_WA_NUMBER?.replace(/[^\d]/g, "");
  if (!number) return null;
  const text = process.env.EXHIBIT_WA_PREFILL ?? "Halo, saya ingin coba asisten SalamDesk";
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export default function ExhibitPage() {
  const waLink = buildWaLink();
  return (
    <div className="flex h-screen flex-col">
      <SpotlightOverlay />
      <HeaderBar />
      <main className="grid flex-1 grid-cols-[20rem_1fr_22rem] gap-6 overflow-hidden p-6">
        {/* Left — live activity ticker */}
        <section className="overflow-hidden">
          <LiveFeed />
        </section>

        {/* Center — pipeline theater */}
        <section className="overflow-hidden">
          <PipelineTheater waLink={waLink} />
        </section>

        {/* Right — stats + QR self-try */}
        <section className="flex flex-col gap-4 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <StatsPanel />
          </div>
          <QrCorner waLink={waLink} />
        </section>
      </main>
    </div>
  );
}
