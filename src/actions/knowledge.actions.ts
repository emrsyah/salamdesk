"use server";

import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { revalidatePath, updateTag } from "next/cache";
import {
  createKbArticle,
  updateKbArticle,
  deleteKbArticle,
  setKbArticleActive,
} from "@/services/knowledge.service";
import { z } from "zod";

const kbArticleSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  moduleId: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

export async function createKbArticleAction(data: z.infer<typeof kbArticleSchema>) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  const parsed = kbArticleSchema.parse(data);

  await createKbArticle({
    id: crypto.randomUUID(),
    title: parsed.title,
    content: parsed.content,
    moduleId: parsed.moduleId,
    tags: parsed.tags,
    createdById: session.user.id,
  });

  revalidatePath("/app/knowledge");
  updateTag("knowledge-base");
}

export async function updateKbArticleAction(
  id: string,
  data: z.infer<typeof kbArticleSchema>
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  const parsed = kbArticleSchema.parse(data);

  await updateKbArticle(id, parsed);

  revalidatePath("/app/knowledge");
  revalidatePath(`/app/knowledge/${id}`);
  updateTag("knowledge-base");
}

export async function deleteKbArticleAction(id: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  await deleteKbArticle(id);

  revalidatePath("/app/knowledge");
  updateTag("knowledge-base");
}

export async function setKbArticleActiveAction(id: string, isActive: boolean) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  await setKbArticleActive(id, isActive);

  revalidatePath("/app/knowledge");
  revalidatePath(`/app/knowledge/${id}`);
  updateTag("knowledge-base");
}

export async function retryKbIngestionAction(id: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  const { requeueKnowledgeDocumentIngestion } = await import(
    "@/services/knowledge.service"
  );
  await requeueKnowledgeDocumentIngestion(id);

  revalidatePath("/app/knowledge");
  updateTag("knowledge-base");
}

export async function getAllKbArticlesAction(moduleId?: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  const { getAllKbArticles } = await import("@/services/knowledge.service");
  return getAllKbArticles({ moduleId });
}
