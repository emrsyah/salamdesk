ALTER TABLE "tickets" ADD COLUMN "resolved_kb_ids" text[];--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "module_confidence" numeric(4, 2);--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "module_set_by" text;