import { db } from "@/db";
import { apiKeys } from "@/db/schema/api-keys";
import { eq } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";

const PREFIX = "sd_live_";

export async function generateApiKey(name: string, adminId: string, expiresInDays?: number) {
  // 1. Generate a secure random string (32 bytes = 64 hex chars)
  const rawSecret = randomBytes(32).toString("hex");
  const rawKey = `${PREFIX}${rawSecret}`;

  // 2. Hash the key for storage
  const hashedKey = createHash("sha256").update(rawKey).digest("hex");

  // 3. Extract prefix for display (e.g., sd_live_a1b2c3d4)
  const displayPrefix = rawKey.substring(0, 16);

  // 4. Calculate expiration
  let expiresAt: Date | null = null;
  if (expiresInDays) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
  }

  // 5. Store in database
  const [newKey] = await db.insert(apiKeys).values({
    name,
    hashedKey,
    prefix: displayPrefix,
    createdById: adminId,
    expiresAt,
  }).returning();

  return {
    rawKey, // Only returned this ONE TIME
    keyId: newKey.id,
  };
}

export async function listApiKeys() {
  return await db.select({
    id: apiKeys.id,
    name: apiKeys.name,
    prefix: apiKeys.prefix,
    isActive: apiKeys.isActive,
    createdAt: apiKeys.createdAt,
    expiresAt: apiKeys.expiresAt,
  })
  .from(apiKeys)
  .orderBy(apiKeys.createdAt);
}

export async function revokeApiKey(id: string) {
  return await db.update(apiKeys)
    .set({ isActive: false })
    .where(eq(apiKeys.id, id))
    .returning();
}

export async function validateApiKey(rawKey: string): Promise<boolean> {
  if (!rawKey || !rawKey.startsWith(PREFIX)) return false;

  // 1. Hash the incoming key
  const hashedKey = createHash("sha256").update(rawKey).digest("hex");

  // 2. Find it in the DB
  const [keyRecord] = await db.select()
    .from(apiKeys)
    .where(eq(apiKeys.hashedKey, hashedKey))
    .limit(1);

  if (!keyRecord) return false;

  // 3. Check if active
  if (!keyRecord.isActive) return false;

  // 4. Check expiration
  if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
    return false;
  }

  return true;
}
