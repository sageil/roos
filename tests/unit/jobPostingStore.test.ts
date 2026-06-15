import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryPostgres } = vi.hoisted(() => ({
  queryPostgres: vi.fn()
}));

vi.mock("../../src/server/database.js", () => ({
  queryPostgres
}));

vi.mock("../../src/server/sql.js", () => ({
  queries: {
    jobPostings: {
      create: "jobPostings.create",
      getActive: "jobPostings.getActive",
      list: "jobPostings.list"
    }
  }
}));

import {
  createJobPosting,
  getActiveJobPosting,
  listJobPostings
} from "../../src/server/jobPostingStore.js";

const jobPostingRow = {
  id: 4,
  created_by_user_id: 1,
  title: "Veterinary Receptionist",
  description: "Manage appointments, client intake, and phone triage.",
  skills: ["client intake", "phone triage"],
  status: "active" as const,
  created_at: "2026-06-14T10:00:00.000Z",
  updated_at: "2026-06-14T10:00:00.000Z",
  match_count: 3,
  average_fit_score: 76,
  top_fit_score: 91
};

describe("jobPostingStore", () => {
  beforeEach(() => {
    queryPostgres.mockReset();
  });

  it("creates a job posting", async () => {
    queryPostgres.mockResolvedValueOnce({ rows: [jobPostingRow] });

    await expect(
      createJobPosting({
        createdByUserId: 1,
      title: "Veterinary Receptionist",
      description: "Manage appointments, client intake, and phone triage.",
      skills: ["client intake", "phone triage"]
    })
    ).resolves.toMatchObject({
      id: 4,
      createdByUserId: 1,
      title: "Veterinary Receptionist",
      skills: ["client intake", "phone triage"],
      status: "active"
    });
    expect(queryPostgres).toHaveBeenCalledWith("jobPostings.create", [
      1,
      "Veterinary Receptionist",
      "Manage appointments, client intake, and phone triage.",
      ["client intake", "phone triage"]
    ]);
  });

  it("lists postings with match aggregates", async () => {
    queryPostgres.mockResolvedValueOnce({ rows: [jobPostingRow] });

    await expect(
      listJobPostings({
        includeArchived: true,
        search: " client intake ",
        semanticJobPostingIds: [4, 8],
        limit: 25
      })
    ).resolves.toEqual([
      {
        id: 4,
        createdByUserId: 1,
        title: "Veterinary Receptionist",
        description: "Manage appointments, client intake, and phone triage.",
        skills: ["client intake", "phone triage"],
        status: "active",
        createdAt: "2026-06-14T10:00:00.000Z",
        updatedAt: "2026-06-14T10:00:00.000Z",
        matchCount: 3,
        averageFitScore: 76,
        topFitScore: 91
      }
    ]);
    expect(queryPostgres).toHaveBeenCalledWith("jobPostings.list", [
      true,
      "client intake",
      [4, 8],
      25,
      0
    ]);
  });

  it("finds active postings and returns undefined for missing postings", async () => {
    queryPostgres.mockResolvedValueOnce({ rows: [jobPostingRow] });
    queryPostgres.mockResolvedValueOnce({ rows: [] });

    await expect(getActiveJobPosting(4)).resolves.toMatchObject({
      id: 4,
      title: "Veterinary Receptionist"
    });
    await expect(getActiveJobPosting(5)).resolves.toBeUndefined();
    expect(queryPostgres).toHaveBeenNthCalledWith(1, "jobPostings.getActive", [4]);
    expect(queryPostgres).toHaveBeenNthCalledWith(2, "jobPostings.getActive", [5]);
  });
});
