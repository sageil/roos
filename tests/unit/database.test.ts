import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  clientQuery,
  clientRelease,
  poolConnect,
  poolEnd,
  poolQuery
} = vi.hoisted(() => ({
  clientQuery: vi.fn(),
  clientRelease: vi.fn(),
  poolConnect: vi.fn(),
  poolEnd: vi.fn(),
  poolQuery: vi.fn()
}));

vi.mock("pg", () => ({
  default: {
    Pool: class {
      connect = poolConnect;
      query = poolQuery;
      end = poolEnd;
    }
  }
}));

vi.mock("../../src/server/config.js", () => ({
  config: {
    databaseUrl: "postgres://test"
  }
}));

vi.mock("../../src/server/sql.js", () => ({
  queries: {
    health: {
      check: "health.check"
    },
    migrations: ["migration.001", "migration.002"],
    transactions: {
      advisoryLock: "transactions.advisoryLock",
      advisoryUnlock: "transactions.advisoryUnlock"
    }
  }
}));

const loadDatabase = async () => {
  vi.resetModules();
  return import("../../src/server/database.js");
};

describe("database", () => {
  beforeEach(() => {
    clientQuery.mockReset();
    clientRelease.mockReset();
    poolConnect.mockReset();
    poolEnd.mockReset();
    poolQuery.mockReset();
  });

  it("runs migrations once and reuses successful initialization", async () => {
    poolConnect.mockResolvedValue({ query: clientQuery, release: clientRelease });
    clientQuery.mockResolvedValue({ rows: [] });
    poolQuery.mockResolvedValue({ rows: [] });
    const { checkPostgres } = await loadDatabase();

    await checkPostgres();
    await checkPostgres();

    expect(poolConnect).toHaveBeenCalledOnce();
    expect(clientQuery).toHaveBeenNthCalledWith(1, "transactions.advisoryLock", [23078787]);
    expect(clientQuery).toHaveBeenNthCalledWith(2, "migration.001");
    expect(clientQuery).toHaveBeenNthCalledWith(3, "migration.002");
    expect(clientQuery).toHaveBeenNthCalledWith(4, "transactions.advisoryUnlock", [23078787]);
    expect(clientRelease).toHaveBeenCalledOnce();
    expect(poolQuery).toHaveBeenCalledTimes(2);
    expect(poolQuery).toHaveBeenCalledWith("health.check");
  });

  it("retries initialization after a transient connection failure", async () => {
    poolConnect
      .mockRejectedValueOnce(new Error("database starting"))
      .mockResolvedValueOnce({ query: clientQuery, release: clientRelease });
    clientQuery.mockResolvedValue({ rows: [] });
    poolQuery.mockResolvedValue({ rows: [] });
    const { checkPostgres } = await loadDatabase();

    await expect(checkPostgres()).rejects.toThrow("database starting");
    await expect(checkPostgres()).resolves.toBeUndefined();

    expect(poolConnect).toHaveBeenCalledTimes(2);
    expect(clientRelease).toHaveBeenCalledOnce();
    expect(poolQuery).toHaveBeenCalledWith("health.check");
  });

  it("releases the migration client even when advisory unlock fails", async () => {
    poolConnect.mockResolvedValue({ query: clientQuery, release: clientRelease });
    clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error("unlock failed"));
    const { initPostgres } = await loadDatabase();

    await expect(initPostgres()).rejects.toThrow("unlock failed");

    expect(clientRelease).toHaveBeenCalledOnce();
  });
});
