import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryPostgres } = vi.hoisted(() => ({
  queryPostgres: vi.fn()
}));

vi.mock("../../src/server/config.js", () => ({
  config: {
    sessionTtlSeconds: 3600
  }
}));

vi.mock("../../src/server/database.js", () => ({
  queryPostgres
}));

vi.mock("../../src/server/sql.js", () => ({
  queries: {
    sessions: {
      create: "sessions.create",
      delete: "sessions.delete",
      deleteExpired: "sessions.deleteExpired",
      findByTokenHash: "sessions.findByTokenHash"
    }
  }
}));

import {
  createSession,
  deleteSession,
  findUserBySessionToken,
  hashSessionToken
} from "../../src/server/sessions.js";

describe("hashSessionToken", () => {
  it("returns a deterministic SHA-256 hex digest", () => {
    const hash = hashSessionToken("session-token");

    expect(hash).toHaveLength(64);
    expect(hash).toBe(hashSessionToken("session-token"));
    expect(hash).not.toBe("session-token");
  });

  it("produces different hashes for different tokens", () => {
    expect(hashSessionToken("one")).not.toBe(hashSessionToken("two"));
  });
});

describe("sessions", () => {
  beforeEach(() => {
    queryPostgres.mockReset();
  });

  it("creates a session using only the hashed token in storage", async () => {
    queryPostgres.mockResolvedValue({ rows: [] });

    const token = await createSession(7);

    expect(token).toHaveLength(43);
    expect(queryPostgres).toHaveBeenNthCalledWith(1, "sessions.deleteExpired");
    expect(queryPostgres).toHaveBeenNthCalledWith(2, "sessions.create", [
      7,
      hashSessionToken(token),
      3600
    ]);
  });

  it("finds a session user by hashed token", async () => {
    queryPostgres.mockResolvedValueOnce({
      rows: [
        {
          id: 7,
          name: "Ada Lovelace",
          email: "ada@example.com",
          role: "admin",
          created_at: "2026-06-14T10:00:00.000Z"
        }
      ]
    });

    await expect(findUserBySessionToken("session-token")).resolves.toEqual({
      id: 7,
      name: "Ada Lovelace",
      email: "ada@example.com",
      role: "admin",
      createdAt: "2026-06-14T10:00:00.000Z"
    });
    expect(queryPostgres).toHaveBeenCalledWith("sessions.findByTokenHash", [
      hashSessionToken("session-token")
    ]);
  });

  it("returns undefined for missing session users", async () => {
    queryPostgres.mockResolvedValueOnce({ rows: [] });

    await expect(findUserBySessionToken("missing")).resolves.toBeUndefined();
  });

  it("deletes sessions by hashed token", async () => {
    queryPostgres.mockResolvedValueOnce({ rows: [] });

    await deleteSession("session-token");

    expect(queryPostgres).toHaveBeenCalledWith("sessions.delete", [
      hashSessionToken("session-token")
    ]);
  });
});
