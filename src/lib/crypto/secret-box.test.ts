import { describe, expect, test } from "bun:test";
import { encryptSecret, decryptSecret } from "./secret-box";

const KEY = "0".repeat(64); // 32 bytes hex

describe("secret-box", () => {
  test("round-trips a secret", () => {
    const enc = encryptSecret("super-secret-token", KEY);
    expect(enc).not.toContain("super-secret-token");
    expect(decryptSecret(enc, KEY)).toBe("super-secret-token");
  });

  test("ciphertext is non-deterministic (random IV)", () => {
    expect(encryptSecret("x", KEY)).not.toBe(encryptSecret("x", KEY));
  });

  test("tampered ciphertext throws", () => {
    const enc = encryptSecret("x", KEY);
    const bad = enc.slice(0, -2) + (enc.endsWith("aa") ? "bb" : "aa");
    expect(() => decryptSecret(bad, KEY)).toThrow();
  });
});
