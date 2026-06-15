import { beforeEach, describe, expect, it, vi } from "vitest";

const { checkPostgres } = vi.hoisted(() => ({
  checkPostgres: vi.fn()
}));

vi.mock("../../src/server/config.js", () => ({
  config: {
    appInstanceName: "app-1",
    appInstanceUrls: "app-1=http://app-1:8787/api/instance-health,app-2=http://app-2:8787/api/instance-health",
    embeddingApiKey: "not-needed",
    embeddingBaseUrl: "http://host.docker.internal:1234/v1",
    embeddingModel: "embedding-model",
    llmApiStyle: "chat",
    llmModel: "local-llm",
    openaiApiKey: undefined,
    openaiBaseUrl: "http://host.docker.internal:1234/v1",
    port: 8787
  }
}));

vi.mock("../../src/server/postgresStore.js", () => ({
  checkPostgres
}));

import { buildSystemHealth, parseInstanceTargets } from "../../src/server/systemHealth.js";

const fetchMock = vi.fn();

describe("parseInstanceTargets", () => {
  it("parses named instance targets", () => {
    expect(parseInstanceTargets("app-1=http://app-1:8787/health,app-2=http://app-2:8787/health")).toEqual([
      { name: "app-1", url: "http://app-1:8787/health" },
      { name: "app-2", url: "http://app-2:8787/health" }
    ]);
  });

  it("falls back to the local instance endpoint", () => {
    expect(parseInstanceTargets("", 9999)).toEqual([
      { name: "app-1", url: "http://127.0.0.1:9999/api/instance-health" }
    ]);
  });
});

describe("buildSystemHealth", () => {
  beforeEach(() => {
    checkPostgres.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("reports online components and app instances", async () => {
    checkPostgres.mockResolvedValueOnce(undefined);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        hostname: "container",
        pid: 19,
        uptimeSeconds: 42
      })
    });

    await expect(buildSystemHealth()).resolves.toMatchObject({
      ok: true,
      components: [
        { name: "PostgreSQL", status: "online" },
        { name: "pgvector", status: "online" },
        { name: "LLM provider", status: "online" },
        { name: "Embedding provider", status: "online" }
      ],
      instances: [
        { name: "app-1", status: "online", hostname: "container", pid: 19, uptimeSeconds: 42 },
        { name: "app-2", status: "online", hostname: "container", pid: 19, uptimeSeconds: 42 }
      ],
      models: {
        llm: "local-llm",
        embedding: "embedding-model",
        llmApiStyle: "chat"
      }
    });
  });

  it("marks the system unhealthy when an app instance is offline", async () => {
    checkPostgres.mockResolvedValueOnce(undefined);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true })
      })
      .mockRejectedValueOnce(new Error("connection refused"));

    const health = await buildSystemHealth();

    expect(health.ok).toBe(false);
    expect(health.instances).toEqual([
      expect.objectContaining({ name: "app-1", status: "online" }),
      expect.objectContaining({ name: "app-2", status: "offline", error: "connection refused" })
    ]);
  });
});
