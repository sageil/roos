import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResumeAnalysis } from "../../src/shared/types.js";

const { connectPostgres, queryPostgres, withPostgres } = vi.hoisted(() => ({
  connectPostgres: vi.fn(),
  queryPostgres: vi.fn(),
  withPostgres: vi.fn((operation: () => unknown) => operation())
}));

vi.mock("../../src/server/config.js", () => ({
  config: {
    embeddingModel: "text-embedding-nomic-embed-text-v1.5-embedding",
    llmModel: "local-llm"
  }
}));

vi.mock("../../src/server/database.js", () => ({
  checkPostgres: vi.fn(),
  connectPostgres,
  queryPostgres,
  withPostgres
}));

vi.mock("../../src/server/sql.js", () => ({
  queries: {
    analysisCache: {
      get: "analysisCache.get",
      upsert: "analysisCache.upsert"
    },
    jobs: {
      complete: "jobs.complete",
      create: "jobs.create",
      fail: "jobs.fail",
      get: "jobs.get",
      listAll: "jobs.listAll",
      listForUser: "jobs.listForUser"
    },
    resumeChunks: {
      match: "resumeChunks.match",
      upsert: "resumeChunks.upsert"
    },
    transactions: {
      begin: "transactions.begin",
      commit: "transactions.commit",
      rollback: "transactions.rollback"
    }
  }
}));

import {
  completeJob,
  createJob,
  failJob,
  getCachedAnalysis,
  getJob,
  listJobs,
  queryJobEvidence,
  storeResumeChunks,
  upsertCachedAnalysis
} from "../../src/server/postgresStore.js";

const jobRow = {
  id: 12,
  user_id: 7,
  job_posting_id: 4,
  job_posting_title: "Platform Staff Engineer",
  user_name: "Ada Lovelace",
  user_email: "ada@example.com",
  status: "completed" as const,
  application_date: "2026-06-14",
  job_title: "Staff Engineer",
  job_description: "Build systems",
  resume_file_name: "resume.pdf",
  character_count: 4200,
  chunk_count: 4,
  llm_recommendation: "Strong match",
  fit_score: 87,
  fit_level: "high" as const,
  analysis_json: null,
  error_message: null,
  llm_model: "local-llm",
  embedding_model: "embedding-model",
  created_at: "2026-06-14T12:00:00.000Z",
  updated_at: "2026-06-14T12:05:00.000Z"
};

const analysis: ResumeAnalysis = {
  candidateSummary: "Candidate summary",
  fitScore: 87,
  fitLevel: "high",
  strengths: ["TypeScript"],
  gaps: ["Kubernetes"],
  risks: ["Limited domain history"],
  recommendations: ["Lead with systems work", "Add measurable outcomes"],
  suggestedKeywords: ["platform"],
  interviewQuestions: ["How did you scale it?"],
  requirementAssessments: [
    {
      category: "technical",
      requirement: "Build TypeScript services",
      importance: "must_have",
      status: "met",
      evidence: ["TypeScript"],
      rationale: "The resume includes direct TypeScript evidence."
    }
  ],
  scoreBreakdown: {
    minimumQualifications: 88,
    technicalCompetencies: 90,
    domainExperience: 80,
    preferredQualifications: 76,
    seniorityScope: 86,
    evidenceQuality: 89
  },
  fairnessReview: {
    ignoredFactors: ["name"],
    notes: ["Only job-related evidence was considered."]
  },
  evidence: [{ id: 1, text: "Built systems", score: 0.92 }]
};

describe("postgresStore", () => {
  beforeEach(() => {
    connectPostgres.mockReset();
    queryPostgres.mockReset();
    withPostgres.mockClear();
  });

  it("creates a job and returns a numeric id", async () => {
    queryPostgres.mockResolvedValueOnce({ rows: [{ id: "12" }] });

    await expect(
      createJob({
        userId: 7,
        applicationDate: "2026-06-14",
        jobTitle: "Staff Engineer",
        jobDescription: "",
        resumeFileName: "resume.pdf",
        characterCount: 4200
      })
    ).resolves.toBe(12);
    expect(queryPostgres).toHaveBeenCalledWith("jobs.create", [
      7,
      null,
      "2026-06-14",
      "Staff Engineer",
      null,
      "resume.pdf",
      4200
    ]);
  });

  it("completes a job with joined recommendations and model metadata", async () => {
    queryPostgres.mockResolvedValueOnce({ rows: [] });

    await completeJob({ id: 12, analysis, chunkCount: 4 });

    expect(queryPostgres).toHaveBeenCalledWith("jobs.complete", [
      4,
      "Lead with systems work\nAdd measurable outcomes",
      87,
      "high",
      JSON.stringify(analysis),
      "local-llm",
      "text-embedding-nomic-embed-text-v1.5-embedding",
      12
    ]);
  });

  it("falls back to candidate summary when recommendations are empty", async () => {
    queryPostgres.mockResolvedValueOnce({ rows: [] });

    await completeJob({
      id: 12,
      analysis: { ...analysis, recommendations: [] },
      chunkCount: 4
    });

    expect(queryPostgres).toHaveBeenCalledWith(
      "jobs.complete",
      expect.arrayContaining(["Candidate summary"])
    );
  });

  it("marks a job failed", async () => {
    queryPostgres.mockResolvedValueOnce({ rows: [] });

    await failJob(12, "Embedding service unavailable");

    expect(queryPostgres).toHaveBeenCalledWith("jobs.fail", [
      "Embedding service unavailable",
      12
    ]);
  });

  it("lists all jobs for admins", async () => {
    queryPostgres.mockResolvedValueOnce({ rows: [jobRow] });

    await expect(listJobs({ userId: 7, role: "admin", limit: 50 })).resolves.toEqual([
      {
        id: 12,
        userId: 7,
        jobPostingId: 4,
        jobPostingTitle: "Platform Staff Engineer",
        userName: "Ada Lovelace",
        userEmail: "ada@example.com",
        status: "completed",
        applicationDate: "2026-06-14",
        jobTitle: "Staff Engineer",
        jobDescription: "Build systems",
        resumeFileName: "resume.pdf",
        characterCount: 4200,
        chunkCount: 4,
        llmRecommendation: "Strong match",
        analysis: undefined,
        fitScore: 87,
        fitLevel: "high",
        errorMessage: undefined,
        llmModel: "local-llm",
        embeddingModel: "embedding-model",
        createdAt: "2026-06-14T12:00:00.000Z",
        updatedAt: "2026-06-14T12:05:00.000Z"
      }
    ]);
    expect(queryPostgres).toHaveBeenCalledWith("jobs.listAll", [50]);
  });

  it("maps stored analysis JSON onto listed jobs", async () => {
    queryPostgres.mockResolvedValueOnce({
      rows: [{ ...jobRow, analysis_json: JSON.stringify(analysis) }]
    });

    await expect(listJobs({ userId: 7, role: "user", limit: 10 })).resolves.toEqual([
      expect.objectContaining({
        id: 12,
        analysis
      })
    ]);
  });

  it("gets cached analysis by key", async () => {
    queryPostgres.mockResolvedValueOnce({
      rows: [{
        cache_key: "cache-key",
        resume_hash: "resume-hash",
        job_profile_hash: "profile-hash",
        llm_model: "local-llm",
        embedding_model: "embedding-model",
        analysis_json: JSON.stringify(analysis),
        chunk_count: 4,
        created_at: "2026-06-14T12:00:00.000Z",
        updated_at: "2026-06-14T12:05:00.000Z"
      }]
    });

    await expect(getCachedAnalysis("cache-key")).resolves.toMatchObject({
      cacheKey: "cache-key",
      resumeHash: "resume-hash",
      jobProfileHash: "profile-hash",
      analysis,
      chunkCount: 4
    });
    expect(queryPostgres).toHaveBeenCalledWith("analysisCache.get", ["cache-key"]);
  });

  it("upserts cached analysis with model metadata", async () => {
    queryPostgres.mockResolvedValueOnce({ rows: [] });

    await upsertCachedAnalysis({
      cacheKey: "cache-key",
      resumeHash: "resume-hash",
      jobProfileHash: "profile-hash",
      analysis,
      chunkCount: 4
    });

    expect(queryPostgres).toHaveBeenCalledWith("analysisCache.upsert", [
      "cache-key",
      "resume-hash",
      "profile-hash",
      "local-llm",
      "text-embedding-nomic-embed-text-v1.5-embedding",
      JSON.stringify(analysis),
      4
    ]);
  });

  it("scopes job lists for regular users", async () => {
    queryPostgres.mockResolvedValueOnce({ rows: [jobRow] });

    await listJobs({ userId: 7, role: "user", limit: 10 });

    expect(queryPostgres).toHaveBeenCalledWith("jobs.listForUser", [7, 10]);
  });

  it("gets jobs with admin bypass or user scoping", async () => {
    queryPostgres.mockResolvedValueOnce({ rows: [jobRow] });
    queryPostgres.mockResolvedValueOnce({ rows: [] });

    await expect(getJob({ id: 12, userId: 7, role: "admin" })).resolves.toMatchObject({
      id: 12,
      userId: 7
    });
    await expect(getJob({ id: 13, userId: 7, role: "user" })).resolves.toBeUndefined();
    expect(queryPostgres).toHaveBeenNthCalledWith(1, "jobs.get", [12, null]);
    expect(queryPostgres).toHaveBeenNthCalledWith(2, "jobs.get", [13, 7]);
  });

  it("stores resume chunks in a transaction", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn()
    };
    connectPostgres.mockResolvedValueOnce(client);

    await storeResumeChunks({
      jobId: 12,
      applicationDate: "2026-06-14",
      jobTitle: "Staff Engineer",
      chunks: [
        { id: 1, text: "first chunk" },
        { id: 2, text: "second chunk" }
      ],
      embeddings: [
        [0.1, 0.2],
        [0.3, 0.4]
      ]
    });

    expect(client.query).toHaveBeenNthCalledWith(1, "transactions.begin");
    expect(client.query).toHaveBeenNthCalledWith(2, "resumeChunks.upsert", [
      12,
      1,
      "first chunk",
      "[0.1,0.2]",
      "2026-06-14",
      "Staff Engineer",
      "text-embedding-nomic-embed-text-v1.5-embedding"
    ]);
    expect(client.query).toHaveBeenNthCalledWith(4, "transactions.commit");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("rolls back chunk storage failures", async () => {
    const error = new Error("insert failed");
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn()
    };
    connectPostgres.mockResolvedValueOnce(client);

    await expect(
      storeResumeChunks({
        jobId: 12,
        applicationDate: "2026-06-14",
        jobTitle: "Staff Engineer",
        chunks: [{ id: 1, text: "first chunk" }],
        embeddings: [[0.1, 0.2]]
      })
    ).rejects.toThrow("insert failed");

    expect(client.query).toHaveBeenLastCalledWith("transactions.rollback");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("queries job evidence with a pgvector literal and rounded scores", async () => {
    queryPostgres.mockResolvedValueOnce({
      rows: [{ chunk_id: 1, document: "Relevant resume text", score: 0.87654 }]
    });

    await expect(
      queryJobEvidence({ jobId: 12, queryEmbedding: [0.1, 0.2], nResults: 5 })
    ).resolves.toEqual([
      {
        id: 1,
        text: "Relevant resume text",
        score: 0.8765
      }
    ]);
    expect(queryPostgres).toHaveBeenCalledWith("resumeChunks.match", [
      12,
      "[0.1,0.2]",
      5
    ]);
  });
});
