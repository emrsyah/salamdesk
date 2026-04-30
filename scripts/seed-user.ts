import "dotenv/config";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import crypto from "node:crypto";
import { account } from "auth-schema";

const EMAIL = process.argv[2] ?? "admin@salamdesk.com";
const PASSWORD = process.argv[3] ?? "password123";
const NAME = process.argv[4] ?? "Admin";

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(`scrypt:${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

async function seed() {
  const userId = crypto.randomUUID();

  const hashedPassword = await hashPassword(PASSWORD);

  await db.insert(users).values({
    id: userId,
    name: NAME,
    email: EMAIL,
    emailVerified: true,
    role: "admin",
  });

  await db.insert(account).values({
    id: crypto.randomUUID(),
    accountId: EMAIL,
    providerId: "credential",
    userId,
    password: hashedPassword,
  });

  console.log(`User created: ${EMAIL} / ${PASSWORD}`);
  console.log("Role: admin");
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
