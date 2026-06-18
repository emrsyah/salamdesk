import { eq } from "drizzle-orm";
import { db } from "@/db";
import { aiConfigs } from "@/db/schema/ai-config";
import { DEFAULT_BUSINESS_HOURS, type BusinessHours } from "@/lib/agent/business-hours";

/**
 * Runtime shape of the AI behaviour config, with numeric thresholds parsed from
 * their DB string representation to plain numbers (0–1).
 */
export type AiConfig = {
  id: string;
  aiTriageEnabled: boolean;
  autoClassifyModule: boolean;
  moduleConfidenceThreshold: number;
  autoSetPriority: boolean;
  autoReplyEnabled: boolean;
  replyConfidenceThreshold: number;
  autoReplyDelayMinutes: number;
  autoReplyChannels: string[];
  skipCriticalPriority: boolean;
  requireKbGrounding: boolean;
  blockedKeywords: string[];
  maxAutoRepliesPerTicket: number;
  // Behavior / voice
  agentName: string;
  persona: string;
  tone: string;
  language: string;
  replySignature: string;
  guardrails: string;
  // Schedule
  businessHours: BusinessHours;
};

/** Defaults used when no config row exists yet (mirror the migration defaults). */
export const DEFAULT_AI_CONFIG: AiConfig = {
  id: "default",
  aiTriageEnabled: true,
  autoClassifyModule: true,
  moduleConfidenceThreshold: 0,
  autoSetPriority: true,
  autoReplyEnabled: true,
  replyConfidenceThreshold: 0.5,
  autoReplyDelayMinutes: 0,
  autoReplyChannels: ["whatsapp"],
  skipCriticalPriority: true,
  requireKbGrounding: true,
  blockedKeywords: [
    "hapus",
    "delete",
    "reset",
    "ubah data",
    "koreksi",
    "down",
    "error massal",
  ],
  maxAutoRepliesPerTicket: 1,
  agentName: "Asisten",
  persona: "",
  tone: "",
  language: "id",
  replySignature: "",
  guardrails: "",
  businessHours: DEFAULT_BUSINESS_HOURS,
};

type AiConfigRow = typeof aiConfigs.$inferSelect;

function rowToConfig(row: AiConfigRow): AiConfig {
  return {
    id: row.id,
    aiTriageEnabled: row.aiTriageEnabled,
    autoClassifyModule: row.autoClassifyModule,
    moduleConfidenceThreshold: Number(row.moduleConfidenceThreshold),
    autoSetPriority: row.autoSetPriority,
    autoReplyEnabled: row.autoReplyEnabled,
    replyConfidenceThreshold: Number(row.replyConfidenceThreshold),
    autoReplyDelayMinutes: row.autoReplyDelayMinutes,
    autoReplyChannels: row.autoReplyChannels,
    skipCriticalPriority: row.skipCriticalPriority,
    requireKbGrounding: row.requireKbGrounding,
    blockedKeywords: row.blockedKeywords,
    maxAutoRepliesPerTicket: row.maxAutoRepliesPerTicket,
    agentName: row.agentName,
    persona: row.persona,
    tone: row.tone,
    language: row.language,
    replySignature: row.replySignature,
    guardrails: row.guardrails,
    businessHours: (row.businessHours as BusinessHours | null) ?? DEFAULT_BUSINESS_HOURS,
  };
}

// Short-lived process cache so the triage worker doesn't hit the DB on every
// ticket. Invalidated on update.
let cache: { config: AiConfig; at: number } | null = null;
const CACHE_TTL_MS = 30_000;

/**
 * Load the singleton AI config. Creates the default row on first use, and
 * falls back to in-memory defaults if the DB is unreachable (so triage never
 * hard-fails purely because config couldn't be read).
 */
export async function getAiConfig(): Promise<AiConfig> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.config;
  }

  try {
    let row = await db.query.aiConfigs.findFirst();
    if (!row) {
      [row] = await db.insert(aiConfigs).values({}).returning();
    }
    const config = rowToConfig(row);
    cache = { config, at: Date.now() };
    return config;
  } catch (error) {
    console.error("[AI] Failed to load ai_config, using defaults:", error);
    return DEFAULT_AI_CONFIG;
  }
}

export type AiConfigUpdate = Partial<Omit<AiConfig, "id">>;

/** Persist a partial update to the singleton config and refresh the cache. */
export async function updateAiConfig(update: AiConfigUpdate): Promise<AiConfig> {
  const existing = await db.query.aiConfigs.findFirst();

  const patch: Partial<AiConfigRow> = { updatedAt: new Date() };
  if (update.aiTriageEnabled !== undefined) patch.aiTriageEnabled = update.aiTriageEnabled;
  if (update.autoClassifyModule !== undefined) patch.autoClassifyModule = update.autoClassifyModule;
  if (update.moduleConfidenceThreshold !== undefined)
    patch.moduleConfidenceThreshold = clamp01(update.moduleConfidenceThreshold).toFixed(2);
  if (update.autoSetPriority !== undefined) patch.autoSetPriority = update.autoSetPriority;
  if (update.autoReplyEnabled !== undefined) patch.autoReplyEnabled = update.autoReplyEnabled;
  if (update.replyConfidenceThreshold !== undefined)
    patch.replyConfidenceThreshold = clamp01(update.replyConfidenceThreshold).toFixed(2);
  if (update.autoReplyDelayMinutes !== undefined)
    patch.autoReplyDelayMinutes = Math.max(0, Math.round(update.autoReplyDelayMinutes));
  if (update.autoReplyChannels !== undefined) patch.autoReplyChannels = update.autoReplyChannels;
  if (update.skipCriticalPriority !== undefined)
    patch.skipCriticalPriority = update.skipCriticalPriority;
  if (update.requireKbGrounding !== undefined) patch.requireKbGrounding = update.requireKbGrounding;
  if (update.blockedKeywords !== undefined)
    patch.blockedKeywords = update.blockedKeywords.flatMap((k) => {
      const trimmed = k.trim();
      return trimmed ? [trimmed] : [];
    });
  if (update.maxAutoRepliesPerTicket !== undefined)
    patch.maxAutoRepliesPerTicket = Math.max(1, Math.round(update.maxAutoRepliesPerTicket));
  if (update.agentName !== undefined) patch.agentName = update.agentName.trim();
  if (update.persona !== undefined) patch.persona = update.persona.trim();
  if (update.tone !== undefined) patch.tone = update.tone.trim();
  if (update.language !== undefined) patch.language = update.language.trim();
  if (update.replySignature !== undefined) patch.replySignature = update.replySignature.trim();
  if (update.guardrails !== undefined) patch.guardrails = update.guardrails.trim();
  if (update.businessHours !== undefined) patch.businessHours = update.businessHours;

  let row: AiConfigRow;
  if (existing) {
    [row] = await db.update(aiConfigs).set(patch).where(eq(aiConfigs.id, existing.id)).returning();
  } else {
    [row] = await db.insert(aiConfigs).values(patch).returning();
  }

  const config = rowToConfig(row);
  cache = { config, at: Date.now() };
  return config;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
