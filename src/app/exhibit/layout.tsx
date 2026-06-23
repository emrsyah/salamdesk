import type { Metadata } from "next";
import { ExhibitStreamProvider } from "./exhibit-stream-context";

export const metadata: Metadata = {
  title: "SalamDesk · Live",
  robots: { index: false, follow: false },
};

/**
 * Standalone kiosk shell for the exhibition wall. Lives outside the authed
 * `/app` routes — it's meant to run on an unauthenticated big screen. Renders
 * on SalamDesk's light-first canvas (white surface, zinc furniture, gold brand)
 * so the wall reads as the same product as the operator console.
 */
export default function ExhibitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side: the kiosk token (if configured) is forwarded to the SSE URL.
  const token = process.env.EXHIBIT_TOKEN;
  return (
    <div className="min-h-screen bg-white text-zinc-950">
      <ExhibitStreamProvider token={token}>{children}</ExhibitStreamProvider>
    </div>
  );
}
