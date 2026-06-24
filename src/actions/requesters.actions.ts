"use server";

import {
  getRequesterTicketHistory,
  updateRequesterProfile,
  type RequesterProfileUpdate,
} from "@/services/requester.service";
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { log } from "@/lib/logger";

const xlog = log("requesters-action");

export async function updateRequesterProfileAction(id: string, data: RequesterProfileUpdate) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  if (!data.displayName.trim()) {
    return { error: "Nama tampilan wajib diisi." };
  }

  try {
    const requester = await updateRequesterProfile(id, data);
    return { success: true, requester };
  } catch (error) {
    xlog.error({ err: error }, "updateRequesterProfileAction failed");
    return { error: "Gagal memperbarui profil pelapor." };
  }
}

export async function getRequesterTicketHistoryAction(requesterId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  return getRequesterTicketHistory(requesterId);
}
