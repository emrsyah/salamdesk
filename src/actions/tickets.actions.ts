"use server";

import { createTicket } from "@/services/ticket.service";
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";

/**
 * NOTE: These actions no longer call revalidatePath because the ticket list
 * is now fetched client-side via /api/tickets. After a successful action the
 * client hooks (useTickets / useTicketDetail) are responsible for re-fetching
 * by calling their refetch() callbacks.
 */

export async function createTicketAction(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() ?? "";
  const moduleId = formData.get("moduleId") as string;
  const priority = formData.get("priority") as "low" | "medium" | "critical";

  if (!title || !moduleId || !priority) {
    return { error: "Judul, modul, dan prioritas wajib diisi." };
  }

  if (!["low", "medium", "critical"].includes(priority)) {
    return { error: "Prioritas tidak valid." };
  }

  try {
    const ticket = await createTicket({
      title,
      description,
      moduleId,
      priority,
      source: "web",
      createdById: session?.user?.id,
    });

    return { success: true, ticketId: ticket.id };
  } catch (err) {
    console.error("createTicketAction error:", err);
    return { error: "Gagal membuat tiket. Silakan coba lagi." };
  }
}

export async function updateTicketStatusAction(id: string, status: any) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  try {
    const { updateTicketStatus } = await import("@/services/ticket.service");
    await updateTicketStatus(id, status);
    return { success: true };
  } catch (err) {
    console.error("updateTicketStatusAction error:", err);
    return { error: "Gagal update status." };
  }
}

export async function assignTicketAction(id: string, assigneeId: string | null) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  try {
    const { assignTicket } = await import("@/services/ticket.service");
    await assignTicket(id, assigneeId);
    return { success: true };
  } catch (err) {
    console.error("assignTicketAction error:", err);
    return { error: "Gagal assign tiket." };
  }
}

export async function resolveTicketAction(
  id: string,
  data: {
    resolutionNote?: string;
    rootCause?: any;
  }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  try {
    const { resolveTicket } = await import("@/services/ticket.service");
    await resolveTicket(id, {
      ...data,
      resolvedById: session.user.id,
    });
    return { success: true };
  } catch (err) {
    console.error("resolveTicketAction error:", err);
    return { error: "Gagal resolve tiket." };
  }
}
