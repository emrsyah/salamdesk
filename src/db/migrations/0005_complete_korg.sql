DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'sla_timer_type' AND n.nspname = 'public') THEN CREATE TYPE "public"."sla_timer_type" AS ENUM('first_response', 'resolution'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'ticket_event_type' AND n.nspname = 'public') THEN CREATE TYPE "public"."ticket_event_type" AS ENUM('status_changed', 'assigned', 'reassigned', 'takeover', 'unassigned', 'module_changed', 'priority_changed', 'sla_warning', 'sla_breached', 'resolved', 'manual_close', 'auto_close', 'reopened', 'ai_recommendation_created', 'ai_recommendation_accepted', 'ai_recommendation_rejected', 'linked_ticket_created'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'ticket_link_type' AND n.nspname = 'public') THEN CREATE TYPE "public"."ticket_link_type" AS ENUM('reopened_from', 'duplicate_of'); END IF; END $$;--> statement-breakpoint
UPDATE "tickets"
SET "status" = CASE
  WHEN "assignee_id" IS NULL THEN 'open'::ticket_status
  ELSE 'in_progress'::ticket_status
END
WHERE "status" = 'waiting'::ticket_status;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "first_response_sla_status" "sla_status" DEFAULT 'safe' NOT NULL;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "first_response_due_at" timestamp;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "first_responded_at" timestamp;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "first_responded_by_id" text;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "resolution_sla_status" "sla_status" DEFAULT 'safe' NOT NULL;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "resolution_due_at" timestamp;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "closed_at" timestamp;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "closed_by_id" text;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "auto_close_due_at" timestamp;--> statement-breakpoint
CREATE TABLE "ticket_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" text NOT NULL,
	"type" "ticket_event_type" NOT NULL,
	"actor_id" text,
	"actor_type" "sender_type" DEFAULT 'system' NOT NULL,
	"from_status" "ticket_status",
	"to_status" "ticket_status",
	"from_assignee_id" text,
	"to_assignee_id" text,
	"from_module_id" uuid,
	"to_module_id" uuid,
	"from_priority" "ticket_priority",
	"to_priority" "ticket_priority",
	"sla_timer" "sla_timer_type",
	"note" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "ticket_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_ticket_id" text NOT NULL,
	"target_ticket_id" text NOT NULL,
	"type" "ticket_link_type" NOT NULL,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_first_responded_by_id_user_id_fk" FOREIGN KEY ("first_responded_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_closed_by_id_user_id_fk" FOREIGN KEY ("closed_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_from_assignee_id_user_id_fk" FOREIGN KEY ("from_assignee_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_to_assignee_id_user_id_fk" FOREIGN KEY ("to_assignee_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_from_module_id_modules_id_fk" FOREIGN KEY ("from_module_id") REFERENCES "public"."modules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_to_module_id_modules_id_fk" FOREIGN KEY ("to_module_id") REFERENCES "public"."modules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_links" ADD CONSTRAINT "ticket_links_source_ticket_id_tickets_id_fk" FOREIGN KEY ("source_ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_links" ADD CONSTRAINT "ticket_links_target_ticket_id_tickets_id_fk" FOREIGN KEY ("target_ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_links" ADD CONSTRAINT "ticket_links_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
