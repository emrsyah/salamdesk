import { boolean, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Organisation-wide AI behaviour configuration.
 *
 * Stored as a singleton row (one per organisation; `organizationId` is reserved
 * for future multi-tenant support). The triage worker reads this on every ticket
 * to decide whether to classify, set priority, and — most importantly — whether
 * and how to auto-reply. Replaces the previously hardcoded constants in
 * `src/lib/ai.ts` and `src/services/auto-reply-policy.service.ts`.
 */
export const aiConfigs = pgTable("ai_configs", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Reserved for multi-tenant; null = global default row.
  organizationId: text("organization_id"),

  // ---- Triage automation -------------------------------------------------
  aiTriageEnabled: boolean("ai_triage_enabled").notNull().default(true),
  autoClassifyModule: boolean("auto_classify_module").notNull().default(true),
  // Below this, the module is left unassigned for a human instead of guessing.
  moduleConfidenceThreshold: numeric("module_confidence_threshold", { precision: 3, scale: 2 })
    .notNull()
    .default("0.00"),
  autoSetPriority: boolean("auto_set_priority").notNull().default(true),
  // When true, KB search ranks across ALL modules (relevance-first) instead of
  // restricting to the classified module. Prevents a misclassified module from
  // hiding the genuinely-relevant article. Default true (relevance wins).
  kbCrossModuleSearch: boolean("kb_cross_module_search").notNull().default(true),
  // Minimum confidence (0–1) the procedure router must have to apply a procedure.
  // Below this, triage falls back to the plain KB reply.
  procedureConfidenceThreshold: numeric("procedure_confidence_threshold", { precision: 3, scale: 2 })
    .notNull()
    .default("0.60"),
  // When true, off-topic tickets (outside the SIMRS/helpdesk scope) are never
  // auto-replied to — drafted for staff instead.
  offTopicGuardEnabled: boolean("off_topic_guard_enabled").notNull().default(true),

  // ---- Auto-reply --------------------------------------------------------
  autoReplyEnabled: boolean("auto_reply_enabled").notNull().default(true),
  replyConfidenceThreshold: numeric("reply_confidence_threshold", { precision: 3, scale: 2 })
    .notNull()
    .default("0.50"),
  // Hold a drafted reply this many minutes before sending, so an agent can
  // intercept. 0 = send immediately (legacy behaviour).
  autoReplyDelayMinutes: integer("auto_reply_delay_minutes").notNull().default(0),
  // Which ticket sources may be auto-replied to (ticket_source values).
  autoReplyChannels: text("auto_reply_channels").array().notNull().default(["whatsapp"]),
  skipCriticalPriority: boolean("skip_critical_priority").notNull().default(true),
  requireKbGrounding: boolean("require_kb_grounding").notNull().default(true),
  // Plain keywords; matched as whole words, case-insensitive. Replaces the old
  // hardcoded RISKY_PATTERNS list.
  blockedKeywords: text("blocked_keywords")
    .array()
    .notNull()
    .default([
      "hapus",
      "delete",
      "reset",
      "ubah data",
      "koreksi",
      "billing",
      "tagihan",
      "pembayaran",
      "pasien",
      "diagnosa",
      "resep",
      "obat",
      "down",
      "error massal",
    ]),
  // Cap auto-replies per ticket (e.g. 1 = only the first inbound).
  maxAutoRepliesPerTicket: integer("max_auto_replies_per_ticket").notNull().default(1),

  // ---- Behavior / voice --------------------------------------------------
  agentName: text("agent_name").notNull().default("Asisten"),
  persona: text("persona").notNull().default(""),
  tone: text("tone").notNull().default(""),
  language: text("language").notNull().default("id"),
  replySignature: text("reply_signature").notNull().default(""),
  guardrails: text("guardrails").notNull().default(""),

  // ---- Schedule ----------------------------------------------------------
  // BusinessHours JSON (see src/lib/agent/business-hours.ts) | null = always-on.
  businessHours: jsonb("business_hours"),
  // When outside business hours, optionally send a one-time acknowledgment to
  // the requester (the real answer is still drafted for staff, not auto-sent).
  offHoursReplyEnabled: boolean("off_hours_reply_enabled").notNull().default(false),
  offHoursMessage: text("off_hours_message")
    .notNull()
    .default(
      "Terima kasih telah menghubungi kami. Saat ini di luar jam operasional — pesan Anda sudah kami terima dan tim akan membalas pada jam kerja berikutnya.",
    ),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
