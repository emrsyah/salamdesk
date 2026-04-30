import { getTickets, getTicketById } from "@/services/ticket.service";
import { getModules } from "@/services/module.service";
import { TicketList } from "@/components/tickets/ticket-list";
import { TicketDetail } from "@/components/tickets/ticket-detail";

export default async function TicketsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const selectedId =
    typeof searchParams.selected === "string" ? searchParams.selected : undefined;

  const [allTickets, allModules, selectedTicket] = await Promise.all([
    getTickets(),
    getModules(),
    selectedId ? getTicketById(selectedId) : Promise.resolve(null),
  ]);

  return (
    <div className="flex h-full w-full bg-background overflow-hidden">
      <TicketList tickets={allTickets} modules={allModules} />
      <TicketDetail ticket={selectedTicket} />
    </div>
  );
}
