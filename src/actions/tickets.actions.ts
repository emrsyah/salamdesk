"use server";

import { buildStaffLifecycleActor } from "@/lib/lifecycle-actor";
import {
  createTicket,
} from "@/services/ticket.service";
import {
  closeResolvedTicket,
  configureTicketCommand,
  findActiveTicketForRequester,
  reopenResolvedTicket,
  resolveTicketWithLifecycle,
  transitionTicketStatus,
} from "@/services/ticket-lifecycle.service";
import { findOrCreateRequesterFromContact } from "@/services/requester.service";
import { aiTriageQueue } from "@/lib/queue";
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";

type RootCause = "bug" | "user_error" | "network" | "third_party" | "configuration" | "hardware" | "other";

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
  const moduleId = (formData.get("moduleId") as string) || null;
  const priority = formData.get("priority") as "low" | "medium" | "critical";
  const requesterName = (formData.get("requesterName") as string)?.trim();
  const requesterEmail = (formData.get("requesterEmail") as string)?.trim().toLowerCase();
  const requesterPhone = (formData.get("requesterPhone") as string)?.trim();

  if (!title || !priority) {
    return { error: "Judul dan prioritas wajib diisi." };
  }

  if (!requesterName && !requesterEmail && !requesterPhone) {
    return { error: "Nama, email, atau nomor WhatsApp pelapor wajib diisi." };
  }

  // For web-created tickets, module is required (user picks from dropdown)
  if (!moduleId) {
    return { error: "Modul wajib diisi untuk tiket web." };
  }

  if (!["low", "medium", "critical"].includes(priority)) {
    return { error: "Prioritas tidak valid." };
  }

  try {
    const requesterId = await findOrCreateRequesterFromContact({
      displayName: requesterName,
      fullName: requesterName,
      email: requesterEmail,
      phone: requesterPhone,
    });

    const activeTicket = await findActiveTicketForRequester(requesterId);
    if (activeTicket) {
      return {
        error: "Pelapor masih memiliki tiket aktif.",
        existingTicketId: activeTicket.id,
      };
    }

    const ticket = await createTicket({
      title,
      description,
      moduleId,
      priority,
      source: "web",
      requesterId,
      openedByStaffId: session?.user?.id,
      createdById: session?.user?.id,
    });

    // Enqueue AI triage — will skip module classification (already set)
    // but will reassess priority and search KB for a helpful reply
    await aiTriageQueue.add("triage", { ticketId: ticket.id });

    return { success: true, ticketId: ticket.id };
  } catch (err) {
    console.error("createTicketAction error:", err);
    return { error: "Gagal membuat tiket. Silakan coba lagi." };
  }
}

export async function updateTicketStatusAction(
  id: string,
  status: "open" | "in_progress" | "resolved" | "closed",
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  try {
    await transitionTicketStatus({
      ticketId: id,
      toStatus: status,
      actorId: session.user.id,
      actorType: "staff",
    });
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
    const actor = await buildStaffLifecycleActor(session.user);
    await configureTicketCommand({
      ticketId: id,
      actor,
      assigneeId,
    });
    return { success: true };
  } catch (err) {
    console.error("assignTicketAction error:", err);
    return { error: "Gagal assign tiket." };
  }
}

export async function changeTicketModuleAction(
  id: string,
  data: { moduleId: string | null; assigneeId?: string | null },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  try {
    const actor = await buildStaffLifecycleActor(session.user);
    await configureTicketCommand({
      ticketId: id,
      actor,
      moduleId: data.moduleId,
      assigneeId: data.assigneeId ?? null,
    });
    return { success: true };
  } catch (err) {
    console.error("changeTicketModuleAction error:", err);
    return { error: "Gagal mengubah modul tiket." };
  }
}

export async function changeTicketPriorityAction(
  id: string,
  priority: "low" | "medium" | "critical",
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  try {
    const actor = await buildStaffLifecycleActor(session.user);
    await configureTicketCommand({
      ticketId: id,
      actor,
      priority,
    });
    return { success: true };
  } catch (err) {
    console.error("changeTicketPriorityAction error:", err);
    return { error: "Gagal mengubah prioritas tiket." };
  }
}

export async function configureTicketAction(
  id: string,
  data: {
    moduleId?: string | null;
    assigneeId?: string | null;
    priority?: "low" | "medium" | "critical";
  },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  try {
    const actor = await buildStaffLifecycleActor(session.user);
    await configureTicketCommand({
      ticketId: id,
      actor,
      moduleId: data.moduleId,
      assigneeId: data.assigneeId,
      priority: data.priority,
    });
    return { success: true };
  } catch (err) {
    console.error("configureTicketAction error:", err);
    return { error: "Gagal menyimpan pengaturan tiket." };
  }
}

export async function resolveTicketAction(
  id: string,
  data: {
    resolutionNote?: string;
    rootCause?: RootCause | null;
    resolvedKbIds?: string[];
  }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  if (!data.resolutionNote?.trim()) {
    return { error: "Catatan penyelesaian wajib diisi." };
  }

  try {
    await resolveTicketWithLifecycle({
      ticketId: id,
      actorId: session.user.id,
      resolutionNote: data.resolutionNote,
      rootCause: data.rootCause,
      resolvedKbIds: data.resolvedKbIds,
    });
    return { success: true };
  } catch (err) {
    console.error("resolveTicketAction error:", err);
    return { error: "Gagal resolve tiket." };
  }
}

export async function reopenTicketAction(id: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  try {
    await reopenResolvedTicket({
      ticketId: id,
      actorId: session.user.id,
      actorType: "staff",
    });
    return { success: true };
  } catch (err) {
    console.error("reopenTicketAction error:", err);
    return { error: "Gagal membuka ulang tiket." };
  }
}

export async function closeTicketAction(id: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  try {
    await closeResolvedTicket({
      ticketId: id,
      actorId: session.user.id,
      actorType: "staff",
      closeType: "manual_close",
    });
    return { success: true };
  } catch (err) {
    console.error("closeTicketAction error:", err);
    return { error: "Gagal menutup tiket." };
  }
}
