import { db } from "@/db";
import { requesterIdentities, requesters } from "@/db/schema/requesters";
import { tickets } from "@/db/schema/tickets";
import { desc, and, eq } from "drizzle-orm";
import crypto from "node:crypto";

type RequesterChannel = "whatsapp" | "web" | "api" | "email";

type RequesterSeed = {
  displayName?: string | null;
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  externalRef?: string | null;
};

function fallbackName(seed: RequesterSeed, identifier: string) {
  return (
    seed.displayName?.trim() ||
    seed.fullName?.trim() ||
    seed.email?.trim() ||
    seed.phone?.trim() ||
    identifier
  );
}

export async function findOrCreateRequesterByIdentity(
  channel: RequesterChannel,
  identifier: string,
  seed: RequesterSeed = {},
): Promise<string> {
  const normalizedIdentifier = identifier.trim().toLowerCase();

  const existingIdentity = await db.query.requesterIdentities.findFirst({
    where: and(
      eq(requesterIdentities.channel, channel),
      eq(requesterIdentities.identifier, normalizedIdentifier),
    ),
    columns: { requesterId: true },
  });

  if (existingIdentity) {
    await db
      .update(requesterIdentities)
      .set({
        displayName: seed.displayName?.trim() || undefined,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(requesterIdentities.channel, channel),
          eq(requesterIdentities.identifier, normalizedIdentifier),
        ),
      );
    return existingIdentity.requesterId;
  }

  const [requester] = await db
    .insert(requesters)
    .values({
      displayName: fallbackName(seed, normalizedIdentifier),
      fullName: seed.fullName?.trim() || null,
      primaryPhone: seed.phone?.trim() || (channel === "whatsapp" ? normalizedIdentifier : null),
      primaryEmail: seed.email?.trim().toLowerCase() || (channel === "email" ? normalizedIdentifier : null),
      externalRef: seed.externalRef?.trim() || null,
    })
    .returning({ id: requesters.id });

  await db.insert(requesterIdentities).values({
    requesterId: requester.id,
    channel,
    identifier: normalizedIdentifier,
    displayName: seed.displayName?.trim() || null,
    lastSeenAt: new Date(),
  });

  return requester.id;
}

export async function findOrCreateRequesterFromContact(seed: RequesterSeed): Promise<string> {
  if (seed.email) return findOrCreateRequesterByIdentity("email", seed.email, seed);
  if (seed.phone) return findOrCreateRequesterByIdentity("whatsapp", seed.phone, seed);
  return findOrCreateRequesterByIdentity("web", crypto.randomUUID(), seed);
}

export type RequesterProfileUpdate = {
  displayName: string;
  fullName?: string | null;
  jobTitle?: string | null;
  employeeNumber?: string | null;
  primaryPhone?: string | null;
  primaryEmail?: string | null;
  externalRef?: string | null;
  notes?: string | null;
};

function optionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function updateRequesterProfile(id: string, data: RequesterProfileUpdate) {
  const [updated] = await db
    .update(requesters)
    .set({
      displayName: data.displayName.trim(),
      fullName: optionalText(data.fullName),
      jobTitle: optionalText(data.jobTitle),
      employeeNumber: optionalText(data.employeeNumber),
      primaryPhone: optionalText(data.primaryPhone),
      primaryEmail: optionalText(data.primaryEmail)?.toLowerCase() ?? null,
      externalRef: optionalText(data.externalRef),
      notes: optionalText(data.notes),
      updatedAt: new Date(),
    })
    .where(eq(requesters.id, id))
    .returning();

  return updated;
}

export async function getRequesterTicketHistory(requesterId: string) {
  return db.query.tickets.findMany({
    where: eq(tickets.requesterId, requesterId),
    columns: {
      id: true,
      title: true,
      status: true,
      priority: true,
      source: true,
      createdAt: true,
      resolvedAt: true,
      closedAt: true,
    },
    with: {
      module: { columns: { id: true, name: true, color: true } },
      assignee: { columns: { id: true, name: true } },
    },
    orderBy: [desc(tickets.createdAt)],
    limit: 20,
  });
}
