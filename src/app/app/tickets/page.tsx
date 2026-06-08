import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { TicketInbox } from "@/components/tickets/ticket-inbox";
import { DEFAULT_TICKET_CONFIGURATION } from "@/lib/tickets/ticket-configuration";
import { getTicketPageData } from "@/lib/tickets/ticket-queries";

interface TicketsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TicketsPage({ searchParams }: TicketsPageProps) {
  const session = await getSession();
  if (!session?.user) redirect("/");

  const user = session.user as typeof session.user & { role: string };
  const resolvedSearchParams = await searchParams;
  const {
    moduleOptions,
    quickReplies,
    assignableStaff,
    initialTickets,
    initialTicket,
  } = await getTicketPageData(user, resolvedSearchParams);

  // Auto-select the first ticket on entry when none is selected yet. If the
  // list is empty we simply render the inbox with no detail open.
  const hasSelected =
    typeof resolvedSearchParams.selected === "string" &&
    resolvedSearchParams.selected.length > 0;
  if (!hasSelected && initialTickets.length > 0) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(resolvedSearchParams)) {
      if (Array.isArray(value)) {
        for (const v of value) params.append(key, v);
      } else if (value !== undefined) {
        params.set(key, value);
      }
    }
    params.set("selected", initialTickets[0].id);
    redirect(`/app/tickets?${params.toString()}`);
  }

  return (
    <TicketInbox
      modules={moduleOptions}
      quickReplies={quickReplies}
      assignableStaff={assignableStaff}
      initialTickets={initialTickets}
      initialTicket={initialTicket}
      defaultConfiguration={{
        ...DEFAULT_TICKET_CONFIGURATION,
        enabledModuleIds: moduleOptions.map((module) => module.id),
      }}
    />
  );
}
