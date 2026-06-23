import type { Metadata } from "next";
import { ExhibitStreamProvider } from "./exhibit-stream-context";

export const metadata: Metadata = {
  title: "SalamDesk · Live",
  robots: { index: false, follow: false },
};

/**
 * Standalone kiosk shell for the exhibition wall. Lives outside the authed
 * `/app` routes — it's meant to run on an unauthenticated big screen. Uses
 * explicit dark colours throughout rather than `dark:` variants, so it renders
 * identically regardless of the visitor/theme setting.
 */
export default function ExhibitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side: the kiosk token (if configured) is forwarded to the SSE URL.
  const token = process.env.EXHIBIT_TOKEN;
  return (
    <div className="dark min-h-screen bg-zinc-950 text-zinc-100">
      <ExhibitStreamProvider token={token}>{children}</ExhibitStreamProvider>
    </div>
  );
}
