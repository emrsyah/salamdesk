"use server";

import { generateApiKey, listApiKeys, revokeApiKey } from "@/lib/api-keys/api-keys.service";
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";

export async function createApiKeyAction(name: string, expiresInDays?: number) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }

  const result = await generateApiKey(name, session.user.id, expiresInDays);
  return result;
}

export async function getApiKeysAction() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }

  return await listApiKeys();
}

export async function revokeApiKeyAction(id: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }

  await revokeApiKey(id);
}
