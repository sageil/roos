import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResumeAnalysis } from "../../src/shared/types.js";

const {
  chatCreate,
  createEmbeddings,
  getCachedAnalysis,
  getEffectiveAppSettings,
  queryJobEvidence,
  storeResumeChunks,
  upsertCachedAnalysis
} = vi.hoisted(() => ({
  chatCreate: vi.fn(),
  createEmbeddings: vi.fn(),
  getCachedAnalysis: vi.fn(),
  getEffectiveAppSettings: vi.fn(),
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

vi.mock("../../src/server/appSettingsStore.js", () => ({
  getEffectiveAppSettings
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
  "Managed veterinary reception workflows with client intake, appointment scheduling, and EFTPOS payments.",
  "Coordinated urgent visit arrivals, vaccination reminders, insurance paperwork, and clinical team handoffs."
].join("\n");

const cachedAnalysis: ResumeAnalysis = {
  candidateSummary: "Cached summary",
  fitScore: 75,
  fitLevel: "high",
  strengths: ["Client intake"],
  gaps: ["Emergency triage"],
  risks: [],
  recommendations: ["Add billing accuracy examples"],
  suggestedKeywords: ["EFTPOS"],
  interviewQuestions: ["How do you calm a distressed pet owner?"],
  requirementAssessments: [
    {
      category: "role_competency",
      requirement: "Manage client intake and appointment scheduling",
      importance: "must_have",
      status: "met",
      evidence: ["Managed veterinary reception workflows"],
      rationale: "The resume directly describes veterinary reception workflow ownership."
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
  strengths: ["Client intake"],
  gaps: ["Emergency triage"],
  risks: [],
  recommendations: ["Add billing accuracy examples"],
  suggestedKeywords: ["EFTPOS"],
  interviewQuestions: ["How do you calm a distressed pet owner?"],
  requirementAssessments: [
    {
      category: "role_competency",
      requirement: "Manage client intake and appointment scheduling",
      importance: "must_have",
      status: "met",
      evidence: ["Managed veterinary reception workflows"],
      rationale: "The resume directly describes veterinary reception workflow ownership."
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
  strengths: ["Managed appointment books", "Handled client intake"],
  gaps: ["No direct evidence of emergency triage ownership"],
  risks: ["Urgent-care prioritisation needs verification"],
  recommendations: ["Add truthful examples of urgent visit coordination"],
  suggestedKeywords: ["phone triage", "urgent visit coordination"],
  interviewQuestions: ["Which urgent visit coordination responsibilities did you own end to end?"],
  requirementAssessments: [
    {
      category: "minimum",
      requirement: "5+ years managing veterinary front desk workflows",
      importance: "must_have",
      status: "met",
      evidence: ["Managed appointment books"],
      rationale: "The resume directly supports veterinary front desk experience."
    },
    {
      category: "role_competency",
      requirement: "Own emergency phone triage end to end",
      importance: "must_have",
      status: "partially_met",
      evidence: ["Handled client intake"],
      rationale: "The resume shows related reception ownership but not direct emergency triage ownership."
    },
    {
      category: "domain",
      requirement: "Experience in veterinary clinic operations",
      importance: "must_have",
      status: "met",
      evidence: ["Supported veterinary clinic teams"],
      rationale: "The resume directly supports the veterinary domain requirement."
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
    getEffectiveAppSettings.mockReset();
    queryJobEvidence.mockReset();
    storeResumeChunks.mockReset();
    upsertCachedAnalysis.mockReset();

    getEffectiveAppSettings.mockResolvedValue({
      openaiApiKey: "not-needed",
      openaiBaseUrl: "http://provider.test/v1",
      llmModel: "local-llm",
      llmApiStyle: "chat",
      embeddingApiKey: "not-needed",
      embeddingBaseUrl: "http://provider.test/v1",
      embeddingModel: "embedding-model",
      embeddingDimensions: 768,
      smtpPort: 587,
      smtpSecure: false,
      emailFromName: "Roos Admin"
    });
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
        "Veterinary Receptionist",
        "Manage client intake, appointment scheduling, EFTPOS payments, and urgent visit coordination."
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
      "Veterinary Receptionist",
      "Manage client intake, appointment scheduling, EFTPOS payments, and urgent visit coordination."
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
      "Veterinary Receptionist",
      "Own emergency phone triage, urgent visit coordination, and veterinary clinic records."
    );

    expect(result.analysis).toMatchObject({
      fitScore: 79,
      fitLevel: "medium",
      scoreBreakdown: partialMustHaveAnalysis.scoreBreakdown,
      requirementAssessments: partialMustHaveAnalysis.requirementAssessments
    });
  });
});
