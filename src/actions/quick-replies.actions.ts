"use server";

import { createQuickReply, updateQuickReply, deleteQuickReply } from "@/services/quick-reply.service";
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { revalidatePath, updateTag } from "next/cache";

export async function createQuickReplyAction(data: {
  label: string;
  content: string;
  moduleId?: string | null;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  await createQuickReply({
    ...data,
    createdById: session.user.id,
  });

  updateTag("quick-replies");
  revalidatePath("/app/quick-replies");
}

export async function updateQuickReplyAction(id: string, data: {
  label: string;
  content: string;
  moduleId?: string | null;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  await updateQuickReply(id, data);

  updateTag("quick-replies");
  revalidatePath("/app/quick-replies");
}

export async function deleteQuickReplyAction(id: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  await deleteQuickReply(id);

  updateTag("quick-replies");
  revalidatePath("/app/quick-replies");
}
