"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/auth";
import { getAiConfig, updateAiConfig, type AiConfig, type AiConfigUpdate } from "@/services/ai-config.service";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string } | null)?.role;
  if (!session?.user || !["owner", "admin"].includes(role ?? "")) {
    throw new Error("Unauthorized");
  }
}

export async function getAiConfigAction(): Promise<AiConfig> {
  await requireAdmin();
  return getAiConfig();
}

export async function updateAiConfigAction(
  update: AiConfigUpdate,
): Promise<{ success: true; config: AiConfig } | { error: string }> {
  await requireAdmin();
  try {
    const config = await updateAiConfig(update);
    revalidatePath("/app");
    return { success: true, config };
  } catch (error) {
    console.error("[AI] Failed to update ai_config:", error);
    return { error: "Gagal menyimpan pengaturan AI." };
  }
}
