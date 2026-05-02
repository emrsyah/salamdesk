"use server";

import { db } from "@/db";
import { aiSuggestions } from "@/db/schema/knowledge-base";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

/**
 * Mark an AI suggestion as helpful or not helpful.
 * Updates ai_suggestions.was_helpful for the given suggestion ID.
 */
export async function markSuggestionHelpfulAction(
  suggestionId: string,
  wasHelpful: boolean
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  await db
    .update(aiSuggestions)
    .set({ wasHelpful })
    .where(eq(aiSuggestions.id, suggestionId))
    .execute();

  revalidatePath("/app/tickets");
  return { success: true };
}
