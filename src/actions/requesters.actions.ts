"use server";

import {
  getRequesterTicketHistory,
  updateRequesterProfile,
  type RequesterProfileUpdate,
} from "@/services/requester.service";
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";

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
    console.error("updateRequesterProfileAction error:", error);
    return { error: "Gagal memperbarui profil pelapor." };
  }
}

export async function getRequesterTicketHistoryAction(requesterId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  return getRequesterTicketHistory(requesterId);
}
