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
      category: "role_competency",
      requirement: "Build TypeScript services",
      importance: "must_have",
      status: "met",
      evidence: ["Built secure TypeScript APIs"],
      rationale: "The resume directly describes TypeScript API delivery."
    }
  ],
  scoreBreakdown: {
    minimumQualifications: 75,
    roleCompetencies: 80,
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
  strengths: ["TypeScript APIs"],
  gaps: ["Kubernetes"],
  risks: [],
  recommendations: ["Add deployment details"],
  suggestedKeywords: ["PostgreSQL"],
  interviewQuestions: ["How did you improve reliability?"],
  requirementAssessments: [
    {
      category: "role_competency",
      requirement: "Build TypeScript services",
      importance: "must_have",
      status: "met",
      evidence: ["Built secure TypeScript APIs"],
      rationale: "The resume directly describes TypeScript API delivery."
    }
  ],
  scoreBreakdown: {
    minimumQualifications: 80,
    roleCompetencies: 84,
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

const partialMustHaveAnalysis = {
  candidateSummary: "The candidate has strong adjacent experience but only partial evidence for a core role requirement.",
  strengths: ["Managed regional accounts", "Led client retention programs"],
  gaps: ["No direct evidence of owning enterprise procurement negotiations"],
  risks: ["Core buying-cycle ownership needs verification"],
  recommendations: ["Add truthful examples of procurement negotiation ownership"],
  suggestedKeywords: ["enterprise procurement", "contract negotiation"],
  interviewQuestions: ["Which procurement negotiations did you own end to end?"],
  requirementAssessments: [
    {
      category: "minimum",
      requirement: "5+ years managing strategic customer accounts",
      importance: "must_have",
      status: "met",
      evidence: ["Managed regional accounts"],
      rationale: "The resume directly supports account management experience."
    },
    {
      category: "role_competency",
      requirement: "Own enterprise procurement negotiations end to end",
      importance: "must_have",
      status: "partially_met",
      evidence: ["Led client retention programs"],
      rationale: "The resume shows related client ownership but not direct procurement negotiation ownership."
    },
    {
      category: "domain",
      requirement: "Experience in regulated financial services",
      importance: "must_have",
      status: "met",
      evidence: ["Supported financial services clients"],
      rationale: "The resume directly supports the domain requirement."
    }
  ],
  scoreBreakdown: {
    minimumQualifications: 95,
    roleCompetencies: 94,
    domainExperience: 96,
    preferredQualifications: 90,
    seniorityScope: 95,
    evidenceQuality: 92
  },
  fairnessReview: {
    ignoredFactors: ["name", "address"],
    notes: ["Only job-related evidence was considered."]
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
        fitScore: 82,
        fitLevel: "high",
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
      fitScore: 84,
      fitLevel: "high",
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

  it("caps strong-fit scoring when any role-agnostic must-have is only partially evidenced", async () => {
    getCachedAnalysis.mockResolvedValueOnce(undefined);
    chatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(partialMustHaveAnalysis) } }]
    });

    const result = await analyzeResume(
      12,
      "2026-06-14",
      resumeText,
      "Strategic Account Manager",
      "Own enterprise customer renewals, procurement negotiations, and regulated financial services accounts."
    );

    expect(result.analysis).toMatchObject({
      fitScore: 79,
      fitLevel: "medium",
      scoreBreakdown: partialMustHaveAnalysis.scoreBreakdown,
      requirementAssessments: partialMustHaveAnalysis.requirementAssessments
    });
  });
});
