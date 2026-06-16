"use server";

import { buildStaffLifecycleActor } from "@/lib/lifecycle-actor";
import { escalateTicketCommand } from "@/services/ticket-lifecycle.service";
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

  const actor = await buildStaffLifecycleActor(session.user);

  await escalateTicketCommand({
    ticketId: data.ticketId,
    actor,
    engineerId: data.engineerId,
    reason: data.reason,
  });

  revalidatePath("/app/tickets");
}
