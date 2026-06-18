import { db } from "@/db";
import { quickReplies } from "@/db/schema/knowledge-base";
import { eq, asc, or, isNull } from "drizzle-orm";

export async function getQuickReplies(moduleId?: string) {
  return db.query.quickReplies.findMany({
    where: moduleId
      ? or(eq(quickReplies.moduleId, moduleId), isNull(quickReplies.moduleId))
      : undefined,
    orderBy: [asc(quickReplies.label)],
  });
}

export async function createQuickReply(data: {
  label: string;
  content: string;
  moduleId?: string | null;
  createdById?: string | null;
}) {
  return db.insert(quickReplies).values({ 
    label: data.label,
    content: data.content,
    moduleId: data.moduleId,
    createdById: data.createdById,
  }).execute();
}

export async function updateQuickReply(id: string, data: {
  label: string;
  content: string;
  moduleId?: string | null;
}) {
  return db.update(quickReplies)
    .set({
      label: data.label,
      content: data.content,
      moduleId: data.moduleId,
    })
    .where(eq(quickReplies.id, id))
    .execute();
}

export async function deleteQuickReply(id: string) {
  return db.delete(quickReplies)
    .where(eq(quickReplies.id, id))
    .execute();
}
