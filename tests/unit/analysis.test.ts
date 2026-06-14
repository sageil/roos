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
  requirementAssessments: [
    {
      category: "technical",
      requirement: "Build TypeScript services",
      importance: "must_have",
      status: "met",
      evidence: ["Built secure TypeScript APIs"],
      rationale: "The resume directly describes TypeScript API delivery."
    }
  ],
  scoreBreakdown: {
    minimumQualifications: 75,
    technicalCompetencies: 80,
    domainExperience: 65,
    preferredQualifications: 60,
    seniorityScope: 74,
    evidenceQuality: 77
  },
  fairnessReview: {
    ignoredFactors: ["name"],
    notes: ["Only job-related evidence was considered."]
  },
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
  interviewQuestions: ["How did you improve reliability?"],
  requirementAssessments: [
    {
      category: "technical",
      requirement: "Build TypeScript services",
      importance: "must_have",
      status: "met",
      evidence: ["Built secure TypeScript APIs"],
      rationale: "The resume directly describes TypeScript API delivery."
    }
  ],
  scoreBreakdown: {
    minimumQualifications: 80,
    technicalCompetencies: 84,
    domainExperience: 70,
    preferredQualifications: 60,
    seniorityScope: 75,
    evidenceQuality: 78
  },
  fairnessReview: {
    ignoredFactors: ["name", "address"],
    notes: ["Only job-related resume evidence was considered."]
  }
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
        requirementAssessments: cachedAnalysis.requirementAssessments,
        scoreBreakdown: cachedAnalysis.scoreBreakdown,
        fairnessReview: cachedAnalysis.fairnessReview,
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
      requirementAssessments: llmAnalysis.requirementAssessments,
      scoreBreakdown: llmAnalysis.scoreBreakdown,
      fairnessReview: llmAnalysis.fairnessReview,
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
