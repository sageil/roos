import { afterEach, describe, expect, it, vi } from "vitest";
import { providerApiKey } from "../../src/server/config.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("providerApiKey", () => {
  it("returns the explicit API key when present", () => {
    expect(providerApiKey("sk-test", undefined)).toBe("sk-test");
  });

  it("uses a placeholder key for OpenAI-compatible local providers", () => {
    expect(providerApiKey(undefined, "http://127.0.0.1:1234/v1")).toBe("not-needed");
  });

  it("throws when neither API key nor compatible base URL is configured", () => {
    expect(() => providerApiKey(undefined, undefined)).toThrow("Missing OPENAI_API_KEY");
  });

  it("defaults embedding dimensions to the pgvector profile schema size", async () => {
    vi.stubEnv("EMBEDDING_DIMENSIONS", "");
    vi.resetModules();

    const { config } = await import("../../src/server/config.js");

    expect(config.embeddingDimensions).toBe(768);
  });

  it("allows embedding dimensions to be overridden", async () => {
    vi.stubEnv("EMBEDDING_DIMENSIONS", "384");
    vi.resetModules();

    const { config } = await import("../../src/server/config.js");

    expect(config.embeddingDimensions).toBe(384);
  });
});
