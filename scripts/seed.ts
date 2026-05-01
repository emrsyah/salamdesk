import "dotenv/config";
import { db } from "@/db";
import { modules, slaConfigs, userModules } from "@/db/schema/modules";
import { users } from "@/db/schema/users";
import { account } from "../auth-schema";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";

const MODULES = [
  { name: "IGD", slug: "igd", color: "#ef4444" },
  { name: "Farmasi", slug: "farmasi", color: "#22c55e" },
  { name: "Billing", slug: "billing", color: "#f97316" },
  { name: "Rawat Inap", slug: "rawat-inap", color: "#3b82f6" },
  { name: "Rawat Jalan", slug: "rawat-jalan", color: "#a855f7" },
  { name: "Radiologi", slug: "radiologi", color: "#eab308" },
  { name: "Laboratorium", slug: "laboratorium", color: "#14b8a6" },
  { name: "Rekam Medis", slug: "rekam-medis", color: "#ec4899" },
];

const SLA_BY_PRIORITY = {
  low: { responseTimeMinutes: 120, resolutionTimeMinutes: 480 },
  medium: { responseTimeMinutes: 60, resolutionTimeMinutes: 240 },
  critical: { responseTimeMinutes: 15, resolutionTimeMinutes: 60 },
} as const;

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(`scrypt:${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

async function seedUser(
  email: string,
  password: string,
  name: string,
  role: "admin" | "agent",
) {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    console.log(`  ${role}: ${email} already exists, skipping.`);
    return;
  }

  const userId = crypto.randomUUID();
  const hashedPassword = await hashPassword(password);

  await db.insert(users).values({
    id: userId,
    name,
    email,
    emailVerified: true,
    role,
  });

  await db.insert(account).values({
    id: crypto.randomUUID(),
    accountId: email,
    providerId: "credential",
    userId,
    password: hashedPassword,
  });

  console.log(`  ${role}: ${email} / ${password}`);
}

async function seed() {
  console.log("🌱 Starting seed...\n");

  console.log("📦 Seeding modules...");
  const inserted = await db
    .insert(modules)
    .values(MODULES)
    .onConflictDoNothing({ target: modules.slug })
    .returning({ id: modules.id, name: modules.name });
  console.log(`✅ Created ${inserted.length} module(s)`);

  if (inserted.length > 0) {
    console.log("⏱️  Seeding SLA configs...");
    const slaRows = inserted.flatMap((mod) =>
      (["low", "medium", "critical"] as const).map((priority) => ({
        moduleId: mod.id,
        priority,
        ...SLA_BY_PRIORITY[priority],
      })),
    );
    await db.insert(slaConfigs).values(slaRows).onConflictDoNothing();
    console.log(`✅ Created ${slaRows.length} SLA config(s)`);
  } else {
    console.log("ℹ️  Modules already seeded, skipping SLA configs.");
  }

  console.log("👤 Seeding users...");
  await seedUser("admin@salamdesk.com", "password123", "Admin SIMRS", "admin");

  // Assign first 4 modules to agent for testing
  const agent = await db.select({ id: users.id }).from(users).where(eq(users.email, "agent@salamdesk.com")).limit(1);
  const agentUserId = agent[0]?.id;

  if (agentUserId) {
    const seededModules = await db.select().from(modules).limit(4);
    const agentModulesToInsert = seededModules.map((module) => ({
      userId: agentUserId,
      moduleId: module.id,
    }));

    await db.insert(userModules).values(agentModulesToInsert);
    console.log(`  ✅ Assigned ${agentModulesToInsert.length} modules to agent`);
  } else {
    console.log("  ⚠️  Could not find agent user to assign modules.");
  }

  console.log("\n🎉 Seed completed successfully!\n");
  console.log("Login credentials:");
  console.log(`  🦾 Admin: admin@salamdesk.com / password123`);
  console.log(`  👤  Agent: agent@salamdesk.com / agent123`);
}

seed()
  .catch((e) => {
    console.error("\n❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
