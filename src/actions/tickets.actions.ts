"use server";

import { createTicket } from "@/services/ticket.service";
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

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

    revalidatePath("/app/tickets");
    return { success: true, ticketId: ticket.id };
  } catch (err) {
    console.error("createTicketAction error:", err);
    return { error: "Gagal membuat tiket. Silakan coba lagi." };
  }
}
