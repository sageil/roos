import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../../src/server/passwords.js";

describe("password hashing", () => {
  it("hashes passwords with scrypt metadata and verifies the original password", async () => {
    const hash = await hashPassword("SecurePass123");

    expect(hash).toMatch(/^scrypt:32768:8:1:[a-f0-9]{32}:[a-f0-9]+$/);
    await expect(verifyPassword("SecurePass123", hash)).resolves.toBe(true);
  });

  it("rejects incorrect passwords and malformed hashes", async () => {
    const hash = await hashPassword("SecurePass123");

    await expect(verifyPassword("WrongPass123", hash)).resolves.toBe(false);
    await expect(verifyPassword("SecurePass123", "not-a-valid-hash")).resolves.toBe(false);
  });

  it("uses a unique salt for each hash", async () => {
    const first = await hashPassword("SecurePass123");
    const second = await hashPassword("SecurePass123");

    expect(first).not.toBe(second);
  });
});
