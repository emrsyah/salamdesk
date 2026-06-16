CREATE TABLE IF NOT EXISTS "ai_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"ai_triage_enabled" boolean DEFAULT true NOT NULL,
	"auto_classify_module" boolean DEFAULT true NOT NULL,
	"module_confidence_threshold" numeric(3, 2) DEFAULT '0.00' NOT NULL,
	"auto_set_priority" boolean DEFAULT true NOT NULL,
	"auto_reply_enabled" boolean DEFAULT true NOT NULL,
	"reply_confidence_threshold" numeric(3, 2) DEFAULT '0.50' NOT NULL,
	"auto_reply_delay_minutes" integer DEFAULT 0 NOT NULL,
	"auto_reply_channels" text[] DEFAULT ARRAY['whatsapp']::text[] NOT NULL,
	"skip_critical_priority" boolean DEFAULT true NOT NULL,
	"require_kb_grounding" boolean DEFAULT true NOT NULL,
	"blocked_keywords" text[] DEFAULT ARRAY['hapus','delete','reset','ubah data','koreksi','billing','tagihan','pembayaran','pasien','diagnosa','resep','obat','down','error massal']::text[] NOT NULL,
	"max_auto_replies_per_ticket" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "ai_configs" ("organization_id") SELECT NULL WHERE NOT EXISTS (SELECT 1 FROM "ai_configs");
