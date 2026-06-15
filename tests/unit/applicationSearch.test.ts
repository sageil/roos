import { beforeEach, describe, expect, it, vi } from "vitest";

const { createEmbeddings, getEffectiveAppSettings, queryMatchingJobIds } = vi.hoisted(() => ({
  createEmbeddings: vi.fn(),
  getEffectiveAppSettings: vi.fn(),
  queryMatchingJobIds: vi.fn()
}));

vi.mock("../../src/server/appSettingsStore.js", () => ({
  getEffectiveAppSettings
}));

vi.mock("../../src/server/embeddings.js", () => ({
  createEmbeddings
}));

vi.mock("../../src/server/postgresStore.js", () => ({
  queryMatchingJobIds
}));

import { matchApplicationsBySemanticQuery } from "../../src/server/applicationSearch.js";

describe("matchApplicationsBySemanticQuery", () => {
  beforeEach(() => {
    createEmbeddings.mockReset();
    getEffectiveAppSettings.mockReset();
    queryMatchingJobIds.mockReset();
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

  it("skips empty semantic application searches", async () => {
    await expect(
      matchApplicationsBySemanticQuery({
        search: "   ",
        userId: 7,
        role: "admin"
      })
    ).resolves.toEqual([]);

    expect(createEmbeddings).not.toHaveBeenCalled();
    expect(queryMatchingJobIds).not.toHaveBeenCalled();
  });

  it("embeds the search and returns matching job ids", async () => {
    createEmbeddings.mockResolvedValueOnce([[0.1, 0.2]]);
    queryMatchingJobIds.mockResolvedValueOnce([
      { jobId: 12, score: 0.91 }
    ]);

    await expect(
      matchApplicationsBySemanticQuery({
        search: " anaesthetic monitoring and patient handling ",
        userId: 7,
        role: "admin",
        limit: 25
      })
    ).resolves.toEqual([
      { jobId: 12, score: 0.91 }
    ]);

    expect(createEmbeddings).toHaveBeenCalledWith(
      ["anaesthetic monitoring and patient handling"],
      expect.objectContaining({
        embeddingModel: "text-embedding-nomic-embed-text-v1.5-embedding"
      })
    );
    expect(queryMatchingJobIds).toHaveBeenCalledWith({
      queryEmbedding: [0.1, 0.2],
      userId: 7,
      role: "admin",
      nResults: 25,
      embeddingModel: "text-embedding-nomic-embed-text-v1.5-embedding"
    });
  });
});
