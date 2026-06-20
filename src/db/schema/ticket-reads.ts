import { pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { tickets } from "./tickets";

/**
 * Per-user read cursor for tickets. One row per (staff member, ticket) the user
 * has opened, holding the time they last viewed it. A ticket is "unread" for a
 * user when tickets.lastInboundAt is newer than their lastReadAt (or no row
 * exists yet). Kept separate from the dormant `notifications` event log because
 * a read cursor is the cheaper, simpler model for inbox unread state.
 */
export const ticketReads = pgTable(
  "ticket_reads",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at").defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.ticketId] }),
  }),
);

export const ticketReadsRelations = relations(ticketReads, ({ one }) => ({
  user: one(users, { fields: [ticketReads.userId], references: [users.id] }),
  ticket: one(tickets, { fields: [ticketReads.ticketId], references: [tickets.id] }),
}));
