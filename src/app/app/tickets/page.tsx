import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getCachedActiveModules, getCachedModulesByUserId, getCachedQuickReplies, getCachedEngineers } from "@/lib/cache";
import { TicketInbox } from "@/components/tickets/ticket-inbox";

export default async function TicketsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/");

  const user = session.user as typeof session.user & { role: string };

  // Fetch stable, cacheable data server-side.
  // The ticket list and ticket detail are fetched client-side in TicketInbox.
  // Start all independent fetches in parallel, including the conditional one.
  const [allActiveModules, userModules, quickReplies, engineers] = await Promise.all([
    getCachedActiveModules(),
    // For agents/engineers: only their assigned modules can be used to create tickets
    (user.role === "agent" || user.role === "engineer")
      ? getCachedModulesByUserId(user.id, { activeOnly: true })
      : Promise.resolve(undefined),
    getCachedQuickReplies(),
    getCachedEngineers(),
  ]);

  const moduleOptions = userModules ?? allActiveModules;

  return (
    <TicketInbox
      modules={moduleOptions as any}
      quickReplies={quickReplies as any}
      engineers={engineers as any}
    />
  );
}
