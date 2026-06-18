import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { agentProcedures } from "@/db/schema/agent";
import { emptyProcedureContent, type ProcedureContent } from "@/lib/agent/procedure-content";

export type AgentProcedureRow = typeof agentProcedures.$inferSelect;

export type ProcedureInput = {
  title: string;
  whenToUse?: string;
  content?: unknown;
  enabled?: boolean;
  order?: number;
};

/** Pure, testable normalization/validation of procedure form input. */
export function normalizeProcedureInput(data: ProcedureInput) {
  const title = (data.title ?? "").trim();
  if (!title) throw new Error("Judul prosedur wajib diisi.");
  const content =
    data.content && typeof data.content === "object"
      ? (data.content as ProcedureContent)
      : emptyProcedureContent();
  return {
    title,
    whenToUse: (data.whenToUse ?? "").trim(),
    content,
    enabled: data.enabled ?? true,
    order: Number.isFinite(data.order) ? Math.trunc(data.order as number) : 0,
  };
}

export async function listProcedures(): Promise<AgentProcedureRow[]> {
  return db
    .select()
    .from(agentProcedures)
    .orderBy(asc(agentProcedures.order), asc(agentProcedures.createdAt))
    .execute();
}

/** Enabled procedures only — what selection/execution and the runtime read. */
export async function listEnabledProcedures(): Promise<AgentProcedureRow[]> {
  return db
    .select()
    .from(agentProcedures)
    .where(eq(agentProcedures.enabled, true))
    .orderBy(asc(agentProcedures.order), asc(agentProcedures.createdAt))
    .execute();
}

export async function getProcedure(id: string): Promise<AgentProcedureRow | null> {
  const [row] = await db.select().from(agentProcedures).where(eq(agentProcedures.id, id));
  return row ?? null;
}

export async function createProcedure(data: ProcedureInput): Promise<AgentProcedureRow> {
  const v = normalizeProcedureInput(data);
  const [row] = await db.insert(agentProcedures).values(v).returning();
  return row;
}

export async function updateProcedure(id: string, data: Partial<ProcedureInput>): Promise<AgentProcedureRow> {
  const patch: Partial<typeof agentProcedures.$inferInsert> = { updatedAt: new Date() };
  if (data.title !== undefined) {
    const t = data.title.trim();
    if (!t) throw new Error("Judul prosedur wajib diisi.");
    patch.title = t;
  }
  if (data.whenToUse !== undefined) patch.whenToUse = data.whenToUse.trim();
  if (data.content !== undefined && typeof data.content === "object")
    patch.content = data.content as ProcedureContent;
  if (data.enabled !== undefined) patch.enabled = data.enabled;
  if (data.order !== undefined) patch.order = Math.trunc(data.order);
  const [row] = await db.update(agentProcedures).set(patch).where(eq(agentProcedures.id, id)).returning();
  return row;
}

export async function deleteProcedure(id: string): Promise<void> {
  await db.delete(agentProcedures).where(eq(agentProcedures.id, id)).execute();
}
