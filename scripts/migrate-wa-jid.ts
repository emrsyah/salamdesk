/**
 * Legacy data migration: convert bare `tickets.wa_phone` values into full
 * WhatsApp addressing JIDs (the format the outbound worker now sends to).
 *
 * Background
 * ----------
 * Before the LID fix, inbound WhatsApp messages stored only the local part of
 * the JID in `tickets.wa_phone` (e.g. "6281234567890" or, on Baileys v7, the
 * anonymised LID "80646684844239"). The outbound worker then rebuilt the JID
 * as `<value>@s.whatsapp.net`, which silently failed for LID-based contacts.
 *
 * The fix stores the full JID in `wa_phone` (e.g. "...@s.whatsapp.net" or
 * "...@lid") and replies to it verbatim. This script back-fills existing rows.
 *
 * Classification (offline heuristic)
 * ----------------------------------
 * We can't reach WhatsApp's LID↔PN mapping offline, so we classify by shape:
 *   - Already contains "@"            → skip (already migrated)
 *   - Matches a plausible phone number → "@s.whatsapp.net"
 *   - Anything else                    → "@lid"
 * Review the printed table before applying. Tune PHONE_PREFIXES if your tenant
 * uses country codes other than Indonesia's +62.
 *
 * Usage
 * -----
 *   bun run tsx scripts/migrate-wa-jid.ts          # dry-run: print the table, write nothing
 *   bun run tsx scripts/migrate-wa-jid.ts --apply   # perform the update
 *
 * Idempotent: re-running skips rows whose wa_phone already contains "@".
 */
import "dotenv/config";
import { db } from "@/db";
import { tickets } from "@/db/schema/tickets";
import { eq, isNotNull } from "drizzle-orm";

// Country-code prefixes (+ length range) that mark a value as a real phone
// number rather than a LID. Default: Indonesia (+62), typical 10–15 digits.
const PHONE_PREFIXES = ["62"];
const PHONE_MIN_DIGITS = 10;
const PHONE_MAX_DIGITS = 15;

function looksLikePhone(value: string): boolean {
  if (!/^\d+$/.test(value)) return false;
  if (value.length < PHONE_MIN_DIGITS || value.length > PHONE_MAX_DIGITS) return false;
  return PHONE_PREFIXES.some((prefix) => value.startsWith(prefix));
}

/** Returns the migrated JID, or null if the value should be left untouched. */
function toJid(waPhone: string): string | null {
  if (waPhone.includes("@")) return null; // already a full JID — skip
  const domain = looksLikePhone(waPhone) ? "s.whatsapp.net" : "lid";
  return `${waPhone}@${domain}`;
}

async function main() {
  const apply = process.argv.includes("--apply");

  const rows = await db
    .select({ id: tickets.id, waPhone: tickets.waPhone })
    .from(tickets)
    .where(isNotNull(tickets.waPhone));

  const plan = rows
    .map((row) => ({ id: row.id, from: row.waPhone!, to: toJid(row.waPhone!) }))
    .filter((row): row is { id: string; from: string; to: string } => row.to !== null);

  const skipped = rows.length - plan.length;

  if (plan.length === 0) {
    console.log(`Nothing to migrate. (${rows.length} WA tickets, ${skipped} already have a JID.)`);
    return;
  }

  const toLid = plan.filter((p) => p.to.endsWith("@lid")).length;
  const toPn = plan.length - toLid;

  console.log(`\n${apply ? "APPLYING" : "DRY-RUN"} — wa_phone → full JID\n`);
  console.log("ticket".padEnd(38), "from".padEnd(20), "→  to");
  console.log("-".repeat(90));
  for (const p of plan) {
    console.log(p.id.padEnd(38), p.from.padEnd(20), "→ ", p.to);
  }
  console.log("-".repeat(90));
  console.log(
    `${plan.length} to update (${toPn} → @s.whatsapp.net, ${toLid} → @lid), ${skipped} skipped.\n`,
  );

  if (!apply) {
    console.log("Dry-run only. Re-run with --apply to write these changes.");
    return;
  }

  let updated = 0;
  for (const p of plan) {
    await db.update(tickets).set({ waPhone: p.to }).where(eq(tickets.id, p.id));
    updated++;
  }
  console.log(`Done. Updated ${updated} ticket(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
