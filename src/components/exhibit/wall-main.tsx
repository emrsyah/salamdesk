"use client";

import { useExhibitStream } from "@/app/exhibit/exhibit-stream-context";
import { AttractScreen } from "./attract-screen";
import { LiveFeed } from "./live-feed";
import { PipelineTheater } from "./pipeline-theater";
import { StatsPanel } from "./stats-panel";
import { QrCorner } from "./qr-corner";

/**
 * The wall has two modes:
 *  - **Idle** (no tickets in flight): a full-bleed, landing-style attract hero —
 *    the booth's job here is to pull a passer-by into scanning, so the empty
 *    operator columns are hidden.
 *  - **Active** (tickets flowing): the three-pane operator console (feed ·
 *    pipeline theater · stats), matching the ticket app.
 */
export function WallMain({ waLink }: { waLink: string | null }) {
  const { pipelines } = useExhibitStream();
  const idle = pipelines.length === 0;

  if (idle) {
    return (
      <main className="min-h-0 flex-1 overflow-y-auto">
        <AttractScreen waLink={waLink} />
      </main>
    );
  }

  return (
    <main className="grid min-h-0 flex-1 grid-cols-[20rem_1fr_22rem] gap-6 overflow-hidden p-6">
      {/* Left — live activity ticker */}
      <section className="overflow-hidden">
        <LiveFeed />
      </section>

      {/* Center — pipeline theater */}
      <section className="overflow-hidden">
        <PipelineTheater />
      </section>

      {/* Right — stats + QR self-try */}
      <section className="flex flex-col gap-4 overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <StatsPanel />
        </div>
        <QrCorner waLink={waLink} />
      </section>
    </main>
  );
}
