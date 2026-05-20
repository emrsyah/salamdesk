"use server";

import { createMessage } from "@/services/message.service";
import { updateTicketStatus, getTicketForWaReply } from "@/services/ticket.service";
import { sendWhatsAppMessage } from "@/services/whatsapp.service";
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
    senderType: "staff",
    content: data.content,
    isInternalNote: data.isInternalNote,
    source: "web",
  });

  // If it's a public reply and the ticket was open, move it to "waiting"
  // (waiting for the reporter to respond)
  if (!data.isInternalNote) {
    await updateTicketStatus(data.ticketId, "waiting");

    // If the ticket originated from WhatsApp, also deliver the reply via WA
    const ticket = await getTicketForWaReply(data.ticketId);
    if (ticket?.source === "whatsapp" && ticket.waPhone) {
      await sendWhatsAppMessage(ticket.waPhone, data.content);
    }
  }

  revalidatePath("/app/tickets");
}
