import { beforeEach, describe, expect, it, vi } from "vitest";

const { createEmbeddings, getEffectiveAppSettings, queryPostgres } = vi.hoisted(() => ({
  createEmbeddings: vi.fn(),
  getEffectiveAppSettings: vi.fn(),
  queryPostgres: vi.fn()
}));

vi.mock("../../src/server/config.js", () => ({
  config: {
    embeddingModel: "text-embedding-nomic-embed-text-v1.5-embedding"
  }
}));

vi.mock("../../src/server/database.js", () => ({
  queryPostgres
}));

vi.mock("../../src/server/appSettingsStore.js", () => ({
  getEffectiveAppSettings
}));

vi.mock("../../src/server/embeddings.js", () => ({
  createEmbeddings
}));

vi.mock("../../src/server/sql.js", () => ({
  queries: {
    userMatchProfiles: {
      source: "userMatchProfiles.source",
      upsert: "userMatchProfiles.upsert",
      match: "userMatchProfiles.match"
    }
  }
}));

import {
  matchAdminUsersBySemanticQuery,
  refreshUserMatchProfile
} from "../../src/server/userMatchProfiles.js";

describe("userMatchProfiles", () => {
  beforeEach(() => {
    createEmbeddings.mockReset();
    getEffectiveAppSettings.mockReset();
    queryPostgres.mockReset();
    getEffectiveAppSettings.mockResolvedValue({
      openaiApiKey: "not-needed",
      llmModel: "local-llm",
      llmApiStyle: "chat",
      embeddingApiKey: "not-needed",
      embeddingModel: "text-embedding-nomic-embed-text-v1.5-embedding",
      embeddingDimensions: 768,
      smtpPort: 587,
      smtpSecure: false,
      emailFromName: "Roos Admin"
    });
  });

  it("refreshes a user's semantic match profile", async () => {
    queryPostgres.mockResolvedValueOnce({
      rows: [{ profile_text: "Resume and application summary" }]
    });
    createEmbeddings.mockResolvedValueOnce([[0.1, 0.2, 0.3]]);
    queryPostgres.mockResolvedValueOnce({ rows: [] });

    await refreshUserMatchProfile(7);

    expect(queryPostgres).toHaveBeenNthCalledWith(1, "userMatchProfiles.source", [7]);
    expect(createEmbeddings).toHaveBeenCalledWith(
      ["Resume and application summary"],
      expect.objectContaining({
        embeddingModel: "text-embedding-nomic-embed-text-v1.5-embedding"
      })
    );
    expect(queryPostgres).toHaveBeenNthCalledWith(2, "userMatchProfiles.upsert", [
      7,
      "Resume and application summary",
      "[0.1,0.2,0.3]",
      "text-embedding-nomic-embed-text-v1.5-embedding"
    ]);
  });

  it("skips profile refresh when there is no text to embed", async () => {
    queryPostgres.mockResolvedValueOnce({ rows: [{ profile_text: "   " }] });

    await refreshUserMatchProfile(7);

    expect(createEmbeddings).not.toHaveBeenCalled();
    expect(queryPostgres).toHaveBeenCalledTimes(1);
  });

  it("matches admin users by semantic query", async () => {
    createEmbeddings.mockResolvedValueOnce([[0.4, 0.5]]);
    queryPostgres.mockResolvedValueOnce({
      rows: [
        { user_id: 9, score: 0.91 },
        { user_id: 7, score: 0.82 }
      ]
    });

    await expect(matchAdminUsersBySemanticQuery(" client intake and phone triage ", 25)).resolves.toEqual([
      { userId: 9, score: 0.91 },
      { userId: 7, score: 0.82 }
    ]);
    expect(createEmbeddings).toHaveBeenCalledWith(
      ["client intake and phone triage"],
      expect.objectContaining({
        embeddingModel: "text-embedding-nomic-embed-text-v1.5-embedding"
      })
    );
    expect(queryPostgres).toHaveBeenCalledWith("userMatchProfiles.match", [
      "[0.4,0.5]",
      "text-embedding-nomic-embed-text-v1.5-embedding",
      25
    ]);
  });

  it("does not call the embedding provider for empty semantic searches", async () => {
    await expect(matchAdminUsersBySemanticQuery("   ")).resolves.toEqual([]);

    expect(createEmbeddings).not.toHaveBeenCalled();
    expect(queryPostgres).not.toHaveBeenCalled();
  });
});
