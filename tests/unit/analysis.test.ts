import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResumeAnalysis } from "../../src/shared/types.js";

const {
  chatCreate,
  createEmbeddings,
  getCachedAnalysis,
  queryJobEvidence,
  storeResumeChunks,
  upsertCachedAnalysis
} = vi.hoisted(() => ({
  chatCreate: vi.fn(),
  createEmbeddings: vi.fn(),
  getCachedAnalysis: vi.fn(),
  queryJobEvidence: vi.fn(),
  storeResumeChunks: vi.fn(),
  upsertCachedAnalysis: vi.fn()
}));

vi.mock("../../src/server/config.js", () => ({
  config: {
    embeddingModel: "embedding-model",
    llmApiStyle: "chat",
    llmModel: "local-llm"
  }
}));

vi.mock("../../src/server/embeddings.js", () => ({
  cosineSimilarity: vi.fn(() => 0.5),
  createEmbeddings
}));

vi.mock("../../src/server/openaiClients.js", () => ({
  createLlmClient: () => ({
    chat: {
      completions: {
        create: chatCreate
      }
    }
  })
}));

vi.mock("../../src/server/postgresStore.js", () => ({
  getCachedAnalysis,
  queryJobEvidence,
  storeResumeChunks,
  upsertCachedAnalysis
}));

import { analyzeResume } from "../../src/server/analysis.js";

const resumeText = [
  "SUMMARY",
  "Built secure TypeScript APIs with PostgreSQL ownership and production support.",
  "Delivered REST services, observability, and reliability improvements."
].join("\n");

const cachedAnalysis: ResumeAnalysis = {
  candidateSummary: "Cached summary",
  fitScore: 75,
  fitLevel: "high",
  strengths: ["TypeScript APIs"],
  gaps: ["Kubernetes"],
  risks: [],
  recommendations: ["Add deployment details"],
  suggestedKeywords: ["PostgreSQL"],
  interviewQuestions: ["How did you improve reliability?"],
  evidence: [{ id: 1, text: "old evidence", score: 0.2 }]
};

const llmAnalysis = {
  candidateSummary: "Fresh summary",
  fitScore: 79,
  fitLevel: "high",
  strengths: ["TypeScript APIs"],
  gaps: ["Kubernetes"],
  risks: [],
  recommendations: ["Add deployment details"],
  suggestedKeywords: ["PostgreSQL"],
  interviewQuestions: ["How did you improve reliability?"]
};

describe("analyzeResume", () => {
  beforeEach(() => {
    chatCreate.mockReset();
    createEmbeddings.mockReset();
    getCachedAnalysis.mockReset();
    queryJobEvidence.mockReset();
    storeResumeChunks.mockReset();
    upsertCachedAnalysis.mockReset();

    createEmbeddings.mockResolvedValue([
      [1, 0],
      [1, 0]
    ]);
    queryJobEvidence.mockResolvedValue([
      { id: 1, text: "fresh evidence", score: 0.7 }
    ]);
  });

  it("reuses cached analysis for identical resume and job inputs", async () => {
    getCachedAnalysis.mockResolvedValueOnce({
      cacheKey: "cache-key",
      resumeHash: "resume-hash",
      jobProfileHash: "profile-hash",
      llmModel: "local-llm",
      embeddingModel: "embedding-model",
      analysis: cachedAnalysis,
      chunkCount: 1,
      createdAt: "2026-06-14T12:00:00.000Z",
      updatedAt: "2026-06-14T12:00:00.000Z"
    });

    await expect(
      analyzeResume(
        12,
        "2026-06-14",
        resumeText,
        "Backend Engineer",
        "Build secure TypeScript services with PostgreSQL."
      )
    ).resolves.toMatchObject({
      analysis: {
        candidateSummary: "Cached summary",
        fitScore: 75,
        fitLevel: "medium",
        evidence: [{ id: 1, text: "fresh evidence", score: 0.7 }]
      },
      chunkCount: 1
    });
    expect(chatCreate).not.toHaveBeenCalled();
    expect(upsertCachedAnalysis).not.toHaveBeenCalled();
  });

  it("uses deterministic chat settings and caches fresh analysis", async () => {
    getCachedAnalysis.mockResolvedValueOnce(undefined);
    chatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(llmAnalysis) } }]
    });

    const result = await analyzeResume(
      12,
      "2026-06-14",
      resumeText,
      "Backend Engineer",
      "Build secure TypeScript services with PostgreSQL."
    );

    expect(chatCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "local-llm",
        temperature: 0,
        top_p: 1
      })
    );
    expect(result.analysis).toMatchObject({
      candidateSummary: "Fresh summary",
      fitScore: 79,
      fitLevel: "medium",
      evidence: [{ id: 1, text: "fresh evidence", score: 0.7 }]
    });
    expect(upsertCachedAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        analysis: result.analysis,
        chunkCount: 1
      })
    );
  });
});
