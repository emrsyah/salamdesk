"use server";

import { escalateTicket } from "@/services/ticket.service";
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export async function escalateTicketAction(data: {
  ticketId: string;
  engineerId: string | null;
  reason: string;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  await escalateTicket(data.ticketId, {
    fromId: session.user.id,
    toId: data.engineerId,
    reason: data.reason,
  });

  revalidatePath("/app/tickets");
}
