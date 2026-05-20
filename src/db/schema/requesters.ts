import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { tickets, ticketMessages } from "./tickets";
import { requesterIdentityChannelEnum } from "./enums";

export const departments = pgTable("departments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const requesters = pgTable(
  "requesters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    displayName: text("display_name").notNull(),
    fullName: text("full_name"),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
    jobTitle: text("job_title"),
    employeeNumber: text("employee_number"),
    primaryPhone: text("primary_phone"),
    primaryEmail: text("primary_email"),
    externalRef: text("external_ref"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("requesters_department_id_idx").on(table.departmentId),
    uniqueIndex("requesters_employee_number_idx").on(table.employeeNumber),
  ],
);

export const requesterIdentities = pgTable(
  "requester_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requesterId: uuid("requester_id")
      .notNull()
      .references(() => requesters.id, { onDelete: "cascade" }),
    channel: requesterIdentityChannelEnum("channel").notNull(),
    identifier: text("identifier").notNull(),
    displayName: text("display_name"),
    verifiedAt: timestamp("verified_at"),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("requester_identities_channel_identifier_idx").on(table.channel, table.identifier),
    index("requester_identities_requester_id_idx").on(table.requesterId),
  ],
);

export const departmentsRelations = relations(departments, ({ many }) => ({
  requesters: many(requesters),
}));

export const requestersRelations = relations(requesters, ({ one, many }) => ({
  department: one(departments, { fields: [requesters.departmentId], references: [departments.id] }),
  identities: many(requesterIdentities),
  tickets: many(tickets),
  messages: many(ticketMessages),
}));

export const requesterIdentitiesRelations = relations(requesterIdentities, ({ one }) => ({
  requester: one(requesters, { fields: [requesterIdentities.requesterId], references: [requesters.id] }),
}));
