import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Format: base64(iv).base64(authTag).base64(ciphertext)
const ALGO = "aes-256-gcm";

function keyBuffer(hexKey: string): Buffer {
  const key = Buffer.from(hexKey, "hex");
  if (key.length !== 32) {
    throw new Error("AGENT_SECRET_KEY must be 32 bytes (64 hex chars).");
  }
  return key;
}

export function encryptSecret(plaintext: string, hexKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, keyBuffer(hexKey), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${ct.toString("base64")}`;
}

export function decryptSecret(payload: string, hexKey: string): string {
  const [ivB64, tagB64, ctB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !ctB64) throw new Error("Malformed secret payload.");
  const decipher = createDecipheriv(ALGO, keyBuffer(hexKey), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
}

/** Reads AGENT_SECRET_KEY from env; throws if absent so callers can disable tools. */
export function getSecretKey(): string {
  const key = process.env.AGENT_SECRET_KEY;
  if (!key) throw new Error("AGENT_SECRET_KEY is not set.");
  return key;
}
