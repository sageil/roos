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
      convertToApplication: "jobs.convertToApplication",
      create: "jobs.create",
      existsForUserPosting: "jobs.existsForUserPosting",
      fail: "jobs.fail",
      get: "jobs.get",
      listAll: "jobs.listAll",
      listForPosting: "jobs.listForPosting",
      listForUser: "jobs.listForUser",
      search: "jobs.search",
      updateInterviewQuestions: "jobs.updateInterviewQuestions"
    },
    resumeChunks: {
      matchJobs: "resumeChunks.matchJobs",
      match: "resumeChunks.match",
      upsert: "resumeChunks.upsert",
      upsertMany: "resumeChunks.upsertMany"
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
  convertJobToApplication,
  createJob,
  failJob,
  getCachedAnalysis,
  getJob,
  hasJobForUserPosting,
  listJobsForPosting,
  listJobs,
  queryMatchingJobIds,
  queryJobEvidence,
  searchJobs,
  storeResumeChunks,
  updateJobInterviewQuestions,
  upsertCachedAnalysis
} from "../../src/server/postgresStore.js";

const jobRow = {
  id: 12,
  user_id: 7,
  job_posting_id: 4,
  analysis_kind: "application" as const,
  job_posting_title: "Veterinary Receptionist",
  user_name: "Priya Patel",
  user_email: "priya@example.com.au",
  status: "completed" as const,
  application_date: "2026-06-14",
  job_title: "Veterinary Receptionist",
  job_description: "Manage client intake and appointment scheduling",
  resume_file_name: "resume.pdf",
  character_count: 4200,
  chunk_count: 4,
  llm_recommendation: "Strong match",
  fit_score: 87,
  fit_level: "high" as const,
  analysis_json: null,
  error_message: null,
  created_at: "2026-06-14T12:00:00.000Z",
  updated_at: "2026-06-14T12:05:00.000Z"
};

const analysis: ResumeAnalysis = {
  candidateSummary: "Candidate summary",
  fitScore: 87,
  fitLevel: "high",
  strengths: ["Client intake"],
  gaps: ["Emergency triage"],
  risks: ["Billing accuracy should be verified"],
  recommendations: ["Lead with reception workflow ownership", "Add measurable client communication outcomes"],
  suggestedKeywords: ["client intake"],
  interviewQuestions: ["How do you handle a distressed pet owner?"],
  requirementAssessments: [
    {
      category: "role_competency",
      requirement: "Manage client intake and appointment scheduling",
      importance: "must_have",
      status: "met",
      evidence: ["Client intake"],
      rationale: "The resume includes direct veterinary reception evidence."
    }
  ],
  scoreBreakdown: {
    minimumQualifications: 88,
    roleCompetencies: 90,
    domainExperience: 80,
    preferredQualifications: 76,
    seniorityScope: 86,
    evidenceQuality: 89
  },
  fairnessReview: {
    ignoredFactors: ["name"],
    notes: ["Only job-related evidence was considered."]
  },
  evidence: [{ id: 1, text: "Managed appointment books and client intake", score: 0.92 }]
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
        jobTitle: "Veterinary Receptionist",
        jobDescription: "",
        resumeFileName: "resume.pdf",
        characterCount: 4200
      })
    ).resolves.toBe(12);
    expect(queryPostgres).toHaveBeenCalledWith("jobs.create", [
      7,
      null,
      "application",
      "2026-06-14",
      "Veterinary Receptionist",
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
      "Lead with reception workflow ownership\nAdd measurable client communication outcomes",
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

  it("converts a candidate assessment to an application", async () => {
    queryPostgres.mockResolvedValueOnce({ rows: [] });

    await convertJobToApplication(12);

    expect(queryPostgres).toHaveBeenCalledWith("jobs.convertToApplication", [12]);
  });

  it("checks whether a user already has a job for a posting", async () => {
    queryPostgres.mockResolvedValueOnce({ rows: [{ exists: true }] });

    await expect(hasJobForUserPosting({ userId: 7, jobPostingId: 4 })).resolves.toBe(true);

    expect(queryPostgres).toHaveBeenCalledWith("jobs.existsForUserPosting", [7, 4]);
  });

  it("lists all jobs for admins", async () => {
    queryPostgres.mockResolvedValueOnce({ rows: [jobRow] });

    await expect(listJobs({ userId: 7, role: "admin", limit: 50 })).resolves.toEqual([
      {
        id: 12,
        userId: 7,
        jobPostingId: 4,
        analysisKind: "application",
        jobPostingTitle: "Veterinary Receptionist",
        userName: "Priya Patel",
        userEmail: "priya@example.com.au",
        status: "completed",
        applicationDate: "2026-06-14",
        jobTitle: "Veterinary Receptionist",
        jobDescription: "Manage client intake and appointment scheduling",
        resumeFileName: "resume.pdf",
        characterCount: 4200,
        chunkCount: 4,
        llmRecommendation: "Strong match",
        analysis: undefined,
        fitScore: 87,
        fitLevel: "high",
        errorMessage: undefined,
        createdAt: "2026-06-14T12:00:00.000Z",
        updatedAt: "2026-06-14T12:05:00.000Z"
      }
    ]);
    expect(queryPostgres).toHaveBeenCalledWith("jobs.listAll", [50, 0]);
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

  it("maps pg jsonb analysis objects onto listed jobs", async () => {
    queryPostgres.mockResolvedValueOnce({
      rows: [{ ...jobRow, analysis_json: analysis }]
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

  it("gets cached pg jsonb analysis objects by key", async () => {
    queryPostgres.mockResolvedValueOnce({
      rows: [{
        cache_key: "cache-key",
        resume_hash: "resume-hash",
        job_profile_hash: "profile-hash",
        llm_model: "local-llm",
        embedding_model: "embedding-model",
        analysis_json: analysis,
        chunk_count: 4,
        created_at: "2026-06-14T12:00:00.000Z",
        updated_at: "2026-06-14T12:05:00.000Z"
      }]
    });

    await expect(getCachedAnalysis("cache-key")).resolves.toMatchObject({
      cacheKey: "cache-key",
      analysis,
      chunkCount: 4
    });
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

    expect(queryPostgres).toHaveBeenCalledWith("jobs.listForUser", [7, 10, 0]);
  });

  it("lists jobs for a specific posting", async () => {
    queryPostgres.mockResolvedValueOnce({ rows: [{ ...jobRow, analysis_json: JSON.stringify(analysis) }] });

    await expect(listJobsForPosting({ jobPostingId: 4, limit: 25 })).resolves.toEqual([
      expect.objectContaining({
        id: 12,
        jobPostingId: 4,
        userName: "Priya Patel",
        analysis
      })
    ]);
    expect(queryPostgres).toHaveBeenCalledWith("jobs.listForPosting", [4, 25, 0]);
  });

  it("searches jobs with exact and semantic inputs", async () => {
    queryPostgres.mockResolvedValueOnce({ rows: [{ ...jobRow, analysis_json: JSON.stringify(analysis) }] });

    await expect(
      searchJobs({
        userId: 7,
        role: "admin",
        search: " client intake ",
        semanticJobIds: [12, 9],
        limit: 25
      })
    ).resolves.toEqual([
      expect.objectContaining({
        id: 12,
        analysis
      })
    ]);
    expect(queryPostgres).toHaveBeenCalledWith("jobs.search", [
      "admin",
      7,
      "client intake",
      [12, 9],
      25,
      0
    ]);
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
      jobTitle: "Veterinary Receptionist",
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
    expect(client.query).toHaveBeenNthCalledWith(2, "resumeChunks.upsertMany", [
      12,
      [1, 2],
      ["first chunk", "second chunk"],
      ["[0.1,0.2]", "[0.3,0.4]"],
      "2026-06-14",
      "Veterinary Receptionist",
      "text-embedding-nomic-embed-text-v1.5-embedding"
    ]);
    expect(client.query).toHaveBeenNthCalledWith(3, "transactions.commit");
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
        jobTitle: "Veterinary Receptionist",
        chunks: [{ id: 1, text: "first chunk" }],
        embeddings: [[0.1, 0.2]]
      })
    ).rejects.toThrow("insert failed");

    expect(client.query).toHaveBeenLastCalledWith("transactions.rollback");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("queries job evidence with a pgvector literal and rounded scores", async () => {
    queryPostgres.mockResolvedValueOnce({
      rows: [
        { chunk_id: 1, document: "Relevant resume text", score: 0.87654 },
        { chunk_id: 2, document: "Numeric string score", score: "0.76543" },
        { chunk_id: 3, document: "Non-finite score", score: Number.NaN }
      ]
    });

    await expect(
      queryJobEvidence({ jobId: 12, queryEmbedding: [0.1, 0.2], nResults: 5 })
    ).resolves.toEqual([
      {
        id: 1,
        text: "Relevant resume text",
        score: 0.8765
      },
      {
        id: 2,
        text: "Numeric string score",
        score: 0.7654
      },
      {
        id: 3,
        text: "Non-finite score",
        score: 0
      }
    ]);
    expect(queryPostgres).toHaveBeenCalledWith("resumeChunks.match", [
      12,
      "[0.1,0.2]",
      5
    ]);
  });

  it("queries matching jobs by semantic resume chunks", async () => {
    queryPostgres.mockResolvedValueOnce({
      rows: [
        { job_id: 12, score: 0.91 },
        { job_id: 9, score: 0.84 }
      ]
    });

    await expect(
      queryMatchingJobIds({
        queryEmbedding: [0.1, 0.2],
        userId: 7,
        role: "user",
        nResults: 10
      })
    ).resolves.toEqual([
      { jobId: 12, score: 0.91 },
      { jobId: 9, score: 0.84 }
    ]);
    expect(queryPostgres).toHaveBeenCalledWith("resumeChunks.matchJobs", [
      "[0.1,0.2]",
      "text-embedding-nomic-embed-text-v1.5-embedding",
      "user",
      7,
      10
    ]);
  });

  it("updates stored interview questions for an analyzed job", async () => {
    queryPostgres.mockResolvedValueOnce({ rows: [] });

    await updateJobInterviewQuestions({
      id: 12,
      interviewQuestions: ["Confirm phone triage ownership.", "Describe urgent visit coordination scope."]
    });

    expect(queryPostgres).toHaveBeenCalledWith("jobs.updateInterviewQuestions", [
      12,
      JSON.stringify(["Confirm phone triage ownership.", "Describe urgent visit coordination scope."])
    ]);
  });
});
