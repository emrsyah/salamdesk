import { boolean, integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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

  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
