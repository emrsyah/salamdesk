-- Manual migration for requester/staff normalization.
-- Designed for Supabase SQL Editor or psql.
--
-- If Supabase complains about "unsafe use of new value" for enum values, run
-- the "ENUMS" section first, then run the rest after it succeeds.
--
-- This file is intentionally outside src/db/migrations so Drizzle will not
-- auto-run it.

-- ENUMS
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'owner';
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'supervisor';
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'operator';
ALTER TYPE "public"."sender_type" ADD VALUE IF NOT EXISTS 'requester';
ALTER TYPE "public"."sender_type" ADD VALUE IF NOT EXISTS 'staff';
ALTER TYPE "public"."sender_type" ADD VALUE IF NOT EXISTS 'ai_agent';
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'requester_identity_channel' AND n.nspname = 'public') THEN CREATE TYPE "public"."requester_identity_channel" AS ENUM('whatsapp', 'web', 'api', 'email'); END IF; END $$;

-- TABLES
CREATE TABLE IF NOT EXISTS "departments" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "name" text NOT NULL, "slug" text NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL, CONSTRAINT "departments_slug_unique" UNIQUE("slug"));
CREATE TABLE IF NOT EXISTS "requesters" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "display_name" text NOT NULL, "full_name" text, "department_id" uuid, "job_title" text, "employee_number" text, "primary_phone" text, "primary_email" text, "external_ref" text, "notes" text, "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL);
CREATE TABLE IF NOT EXISTS "requester_identities" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "requester_id" uuid NOT NULL, "channel" "requester_identity_channel" NOT NULL, "identifier" text NOT NULL, "display_name" text, "verified_at" timestamp, "last_seen_at" timestamp DEFAULT now() NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL);

-- CONSTRAINTS
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'requesters_department_id_departments_id_fk') THEN EXECUTE 'ALTER TABLE "requesters" ADD CONSTRAINT "requesters_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'requester_identities_requester_id_requesters_id_fk') THEN EXECUTE 'ALTER TABLE "requester_identities" ADD CONSTRAINT "requester_identities_requester_id_requesters_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."requesters"("id") ON DELETE CASCADE'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "requesters_department_id_idx" ON "requesters" ("department_id");
CREATE UNIQUE INDEX IF NOT EXISTS "requesters_employee_number_idx" ON "requesters" ("employee_number");
CREATE UNIQUE INDEX IF NOT EXISTS "requester_identities_channel_identifier_idx" ON "requester_identities" ("channel", "identifier");
CREATE INDEX IF NOT EXISTS "requester_identities_requester_id_idx" ON "requester_identities" ("requester_id");

-- TICKET COLUMNS AND CONSTRAINTS
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "requester_id" uuid;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "opened_by_staff_id" text;
ALTER TABLE "ticket_messages" ADD COLUMN IF NOT EXISTS "requester_id" uuid;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_requester_id_requesters_id_fk') THEN EXECUTE 'ALTER TABLE "tickets" ADD CONSTRAINT "tickets_requester_id_requesters_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."requesters"("id") ON DELETE SET NULL'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_opened_by_staff_id_user_id_fk') THEN EXECUTE 'ALTER TABLE "tickets" ADD CONSTRAINT "tickets_opened_by_staff_id_user_id_fk" FOREIGN KEY ("opened_by_staff_id") REFERENCES "public"."user"("id") ON DELETE SET NULL'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ticket_messages_requester_id_requesters_id_fk') THEN EXECUTE 'ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_requester_id_requesters_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."requesters"("id") ON DELETE SET NULL'; END IF; END $$;

-- BACKFILL REQUESTERS FROM LEGACY REPORTER USERS
INSERT INTO "requesters" ("display_name", "full_name", "primary_phone", "primary_email", "external_ref") SELECT "user"."name", "user"."name", "user"."phone", "user"."email", "user"."id" FROM "user" WHERE "user"."role"::text = 'reporter' AND NOT EXISTS (SELECT 1 FROM "requesters" WHERE "requesters"."external_ref" = "user"."id");
INSERT INTO "requester_identities" ("requester_id", "channel", "identifier", "display_name") SELECT "requesters"."id", 'email', lower("requesters"."primary_email"), "requesters"."display_name" FROM "requesters" WHERE "requesters"."primary_email" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "requester_identities" WHERE "requester_identities"."channel" = 'email' AND "requester_identities"."identifier" = lower("requesters"."primary_email"));
INSERT INTO "requester_identities" ("requester_id", "channel", "identifier", "display_name") SELECT "requesters"."id", 'whatsapp', "requesters"."primary_phone", "requesters"."display_name" FROM "requesters" WHERE "requesters"."primary_phone" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "requester_identities" WHERE "requester_identities"."channel" = 'whatsapp' AND "requester_identities"."identifier" = "requesters"."primary_phone");

-- BACKFILL TICKET LINKS AND MESSAGE SENDERS
UPDATE "tickets" SET "requester_id" = "requesters"."id" FROM "requesters" WHERE "tickets"."requester_id" IS NULL AND "tickets"."created_by_id" = "requesters"."external_ref";
UPDATE "ticket_messages" SET "requester_id" = "requesters"."id" FROM "requesters" WHERE "ticket_messages"."requester_id" IS NULL AND "ticket_messages"."sender_id" = "requesters"."external_ref";
UPDATE "ticket_messages" SET "sender_type" = 'requester' WHERE "sender_type"::text = 'user' AND "requester_id" IS NOT NULL;
UPDATE "ticket_messages" SET "sender_type" = 'staff' WHERE "sender_type"::text = 'user' AND "requester_id" IS NULL;
UPDATE "ticket_messages" SET "sender_type" = 'ai_agent' WHERE "sender_type"::text = 'ai_bot';
UPDATE "tickets" SET "opened_by_staff_id" = "created_by_id" WHERE "opened_by_staff_id" IS NULL AND "requester_id" IS NULL;

-- STAFF ROLE DEFAULT AND LEGACY ROLE DATA
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'operator';
UPDATE "user" SET "role" = 'operator' WHERE "role"::text IN ('agent', 'reporter');
