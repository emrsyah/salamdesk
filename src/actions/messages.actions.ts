"use server";

import { buildStaffLifecycleActor } from "@/lib/lifecycle-actor";
import {
  addStaffReplyCommand,
  type MessageAttachmentInput,
} from "@/services/ticket-lifecycle.service";
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export async function sendReplyAction(data: {
  ticketId: string;
  content: string;
  isInternalNote: boolean;
  attachments?: MessageAttachmentInput[];
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  const actor = await buildStaffLifecycleActor(session.user);

  await addStaffReplyCommand({
    ticketId: data.ticketId,
    actor,
    content: data.content,
    visibility: data.isInternalNote ? "internal" : "public",
    source: "web",
    attachments: data.attachments,
  });

  revalidatePath("/app/tickets");
}
