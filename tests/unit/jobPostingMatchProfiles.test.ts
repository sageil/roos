import { beforeEach, describe, expect, it, vi } from "vitest";

const { createEmbeddings, queryPostgres } = vi.hoisted(() => ({
  createEmbeddings: vi.fn(),
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

vi.mock("../../src/server/embeddings.js", () => ({
  createEmbeddings
}));

vi.mock("../../src/server/sql.js", () => ({
  queries: {
    jobPostingMatchProfiles: {
      source: "jobPostingMatchProfiles.source",
      upsert: "jobPostingMatchProfiles.upsert",
      match: "jobPostingMatchProfiles.match"
    }
  }
}));

import {
  matchJobPostingsBySemanticQuery,
  refreshJobPostingMatchProfile
} from "../../src/server/jobPostingMatchProfiles.js";

describe("jobPostingMatchProfiles", () => {
  beforeEach(() => {
    createEmbeddings.mockReset();
    queryPostgres.mockReset();
  });

  it("refreshes a job posting semantic match profile", async () => {
    queryPostgres.mockResolvedValueOnce({
      rows: [{ profile_text: "Role: Platform Engineer\nSkills: PostgreSQL, Kubernetes" }]
    });
    createEmbeddings.mockResolvedValueOnce([[0.1, 0.2, 0.3]]);
    queryPostgres.mockResolvedValueOnce({ rows: [] });

    await refreshJobPostingMatchProfile(4);

    expect(queryPostgres).toHaveBeenNthCalledWith(1, "jobPostingMatchProfiles.source", [4]);
    expect(createEmbeddings).toHaveBeenCalledWith([
      "Role: Platform Engineer\nSkills: PostgreSQL, Kubernetes"
    ]);
    expect(queryPostgres).toHaveBeenNthCalledWith(2, "jobPostingMatchProfiles.upsert", [
      4,
      "Role: Platform Engineer\nSkills: PostgreSQL, Kubernetes",
      "[0.1,0.2,0.3]",
      "text-embedding-nomic-embed-text-v1.5-embedding"
    ]);
  });

  it("skips profile refresh when there is no text to embed", async () => {
    queryPostgres.mockResolvedValueOnce({ rows: [{ profile_text: "   " }] });

    await refreshJobPostingMatchProfile(4);

    expect(createEmbeddings).not.toHaveBeenCalled();
    expect(queryPostgres).toHaveBeenCalledTimes(1);
  });

  it("matches job postings by semantic query", async () => {
    createEmbeddings.mockResolvedValueOnce([[0.4, 0.5]]);
    queryPostgres.mockResolvedValueOnce({
      rows: [
        { job_posting_id: 8, score: 0.92 },
        { job_posting_id: 4, score: 0.81 }
      ]
    });

    await expect(matchJobPostingsBySemanticQuery(" financial controls analyst ", 25)).resolves.toEqual([
      { jobPostingId: 8, score: 0.92 },
      { jobPostingId: 4, score: 0.81 }
    ]);
    expect(createEmbeddings).toHaveBeenCalledWith(["financial controls analyst"]);
    expect(queryPostgres).toHaveBeenCalledWith("jobPostingMatchProfiles.match", [
      "[0.4,0.5]",
      "text-embedding-nomic-embed-text-v1.5-embedding",
      25
    ]);
  });

  it("does not call the embedding provider for empty semantic searches", async () => {
    await expect(matchJobPostingsBySemanticQuery("   ")).resolves.toEqual([]);

    expect(createEmbeddings).not.toHaveBeenCalled();
    expect(queryPostgres).not.toHaveBeenCalled();
  });
});
