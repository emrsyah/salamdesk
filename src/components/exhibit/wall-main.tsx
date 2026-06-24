"use client";

import { useExhibitStream } from "@/app/exhibit/exhibit-stream-context";
import { AttractScreen } from "./attract-screen";
import { LiveFeed } from "./live-feed";
import { PipelineTheater } from "./pipeline-theater";
import { WallFooter } from "./wall-footer";

/**
 * The wall has two modes:
 *  - **Idle** (no tickets in flight): a full-bleed, landing-style attract hero.
 *  - **Active** (tickets flowing): the triage engine is the hero — a large
 *    center stage of live node graphs — flanked by a narrow activity ticker on
 *    the left and a slim metrics strip along the bottom. Everything that isn't
 *    the engine is deliberately demoted.
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
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden p-2 md:grid-cols-[15rem_1fr] md:gap-4 md:p-4">
        {/* Left — narrow activity ticker (secondary). Hidden on phones, where the
            engine is the whole story and screen space is scarce. */}
        <section className="hidden overflow-hidden md:block">
          <LiveFeed />
        </section>

        {/* Center — the triage engine, the hero */}
        <section className="overflow-hidden">
          <PipelineTheater />
        </section>
      </div>

      {/* Bottom — demoted metrics + scan-to-try */}
      <WallFooter waLink={waLink} />
    </main>
  );
}
