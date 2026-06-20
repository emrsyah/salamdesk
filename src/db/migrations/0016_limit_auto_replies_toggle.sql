-- Optional per-ticket auto-reply cap: a toggle to enable the limit at all.
-- Default true preserves the historical "cap at maxAutoRepliesPerTicket" behaviour.
ALTER TABLE "ai_configs" ADD COLUMN IF NOT EXISTS "limit_auto_replies_per_ticket" boolean DEFAULT true NOT NULL;
