import { HeaderBar } from "@/components/exhibit/header-bar";
import { WallMain } from "@/components/exhibit/wall-main";
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
    <div className="relative isolate flex h-screen flex-col overflow-hidden">
      {/* Brand atmosphere — the landing-page sky, fading into the canvas so the
          operator console stays legible underneath it. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-x-0 top-0 h-[90vh] bg-cover bg-top bg-no-repeat opacity-90"
          style={{
            backgroundImage: "url(/bg/4.png)",
            maskImage:
              "linear-gradient(to bottom, black 55%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, black 55%, transparent 100%)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/55 to-background" />
        <div className="absolute -top-32 left-1/2 size-[720px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
      </div>

      <SpotlightOverlay />
      <HeaderBar />
      <WallMain waLink={waLink} />
    </div>
  );
}
