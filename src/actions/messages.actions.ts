"use server";

import { createMessage } from "@/services/message.service";
import { updateTicketStatus } from "@/services/ticket.service";
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export async function sendReplyAction(data: {
  ticketId: string;
  content: string;
  isInternalNote: boolean;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  await createMessage({
    ticketId: data.ticketId,
    senderId: session.user.id,
    senderType: "user",
    content: data.content,
    isInternalNote: data.isInternalNote,
    source: "web",
  });

  // If it's a public reply and the ticket was open, move it to in_progress or waiting?
  // Usually, if an agent replies, it might move to "waiting" (for reporter)
  if (!data.isInternalNote) {
    await updateTicketStatus(data.ticketId, "waiting");
  }

  revalidatePath("/app/tickets");
}
