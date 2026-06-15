import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryPostgres } = vi.hoisted(() => ({
  queryPostgres: vi.fn()
}));

vi.mock("../../src/server/database.js", () => ({
  queryPostgres
}));

vi.mock("../../src/server/sql.js", () => ({
  queries: {
    admin: {
      stats: "admin.stats"
    },
    users: {
      create: "users.create",
      findByEmail: "users.findByEmail",
      list: "users.list",
      listAdminDetails: "users.listAdminDetails",
      updateProfile: "users.updateProfile",
      upsertAdmin: "users.upsertAdmin"
    }
  }
}));

import {
  createUser,
  findUserByEmail,
  getAdminStats,
  listAdminUserDetails,
  listUsers,
  updateUserProfile,
  upsertAdminUser
} from "../../src/server/userStore.js";

const userRow = {
  id: 7,
  name: "Ada Lovelace",
  email: "ada@example.com",
  role: "user" as const,
  password_hash: "hash",
  created_at: "2026-06-14T10:00:00.000Z"
};

describe("userStore", () => {
  beforeEach(() => {
    queryPostgres.mockReset();
  });

  it("creates users with normalized emails", async () => {
    queryPostgres.mockResolvedValueOnce({ rows: [userRow] });

    await expect(
      createUser({ name: "Ada Lovelace", email: "ADA@EXAMPLE.COM", passwordHash: "hash" })
    ).resolves.toEqual({
      id: 7,
      name: "Ada Lovelace",
      email: "ada@example.com",
      role: "user",
      createdAt: "2026-06-14T10:00:00.000Z"
    });
    expect(queryPostgres).toHaveBeenCalledWith("users.create", [
      "Ada Lovelace",
      "ada@example.com",
      "hash"
    ]);
  });

  it("turns duplicate user inserts into a stable application error", async () => {
    queryPostgres.mockRejectedValueOnce({ code: "23505" });

    await expect(
      createUser({ name: "Ada Lovelace", email: "ada@example.com", passwordHash: "hash" })
    ).rejects.toThrow("An account with that email already exists.");
  });

  it("finds a user by email with the stored password hash", async () => {
    queryPostgres.mockResolvedValueOnce({ rows: [userRow] });

    await expect(findUserByEmail("ADA@EXAMPLE.COM")).resolves.toEqual({
      user: {
        id: 7,
        name: "Ada Lovelace",
        email: "ada@example.com",
        role: "user",
        createdAt: "2026-06-14T10:00:00.000Z"
      },
      passwordHash: "hash"
    });
    expect(queryPostgres).toHaveBeenCalledWith("users.findByEmail", ["ada@example.com"]);
  });

  it("returns undefined when no user matches the email", async () => {
    queryPostgres.mockResolvedValueOnce({ rows: [] });

    await expect(findUserByEmail("missing@example.com")).resolves.toBeUndefined();
  });

  it("updates profile fields with normalized email", async () => {
    queryPostgres.mockResolvedValueOnce({ rows: [{ ...userRow, name: "Ada Byron" }] });

    await expect(
      updateUserProfile({ id: 7, name: "Ada Byron", email: "ADA@EXAMPLE.COM" })
    ).resolves.toMatchObject({
      id: 7,
      name: "Ada Byron",
      email: "ada@example.com"
    });
    expect(queryPostgres).toHaveBeenCalledWith("users.updateProfile", [
      7,
      "Ada Byron",
      "ada@example.com"
    ]);
  });

  it("turns duplicate profile emails into a stable application error", async () => {
    queryPostgres.mockRejectedValueOnce({ code: "23505" });

    await expect(
      updateUserProfile({ id: 7, name: "Ada Lovelace", email: "ada@example.com" })
    ).rejects.toThrow("An account with that email already exists.");
  });

  it("lists users with application counts for admins", async () => {
    queryPostgres.mockResolvedValueOnce({
      rows: [{ ...userRow, application_count: 3 }]
    });

    await expect(listUsers(25)).resolves.toEqual([
      {
        id: 7,
        name: "Ada Lovelace",
        email: "ada@example.com",
        role: "user",
        createdAt: "2026-06-14T10:00:00.000Z",
        applicationCount: 3
      }
    ]);
    expect(queryPostgres).toHaveBeenCalledWith("users.list", [25]);
  });

  it("lists admin user details with latest resume, matched terms, and recent applications", async () => {
    queryPostgres.mockResolvedValueOnce({
      rows: [{
        ...userRow,
        application_count: 2,
        matched_terms: ["PostgreSQL", "TypeScript"],
        resume_json: {
          id: 11,
          userId: 7,
          versionNumber: 2,
          fileName: "resume-v2.pdf",
          contentType: "application/pdf",
          characterCount: 4200,
          createdAt: "2026-06-14T12:00:00.000Z"
        },
        recent_jobs_json: [{
          id: 20,
          userId: 7,
          status: "completed",
          applicationDate: "2026-06-14",
          jobTitle: "Platform Engineer",
          fitScore: 82,
          fitLevel: "high",
          createdAt: "2026-06-14T12:00:00.000Z",
          updatedAt: "2026-06-14T12:05:00.000Z"
        }]
      }]
    });

    await expect(
      listAdminUserDetails({ search: " postgres ", semanticUserIds: [7, 9], limit: 25 })
    ).resolves.toEqual([
      {
        id: 7,
        name: "Ada Lovelace",
        email: "ada@example.com",
        role: "user",
        createdAt: "2026-06-14T10:00:00.000Z",
        applicationCount: 2,
        matchedTerms: ["PostgreSQL", "TypeScript"],
        latestResume: {
          id: 11,
          userId: 7,
          versionNumber: 2,
          fileName: "resume-v2.pdf",
          contentType: "application/pdf",
          characterCount: 4200,
          createdAt: "2026-06-14T12:00:00.000Z"
        },
        recentApplications: [
          {
            id: 20,
            userId: 7,
            status: "completed",
            applicationDate: "2026-06-14",
            jobTitle: "Platform Engineer",
            fitScore: 82,
            fitLevel: "high",
            createdAt: "2026-06-14T12:00:00.000Z",
            updatedAt: "2026-06-14T12:05:00.000Z"
          }
        ]
      }
    ]);
    expect(queryPostgres).toHaveBeenCalledWith("users.listAdminDetails", ["postgres", [7, 9], 25]);
  });

  it("upserts an admin with normalized email", async () => {
    const adminRow = { ...userRow, email: "admin@example.com", role: "admin" as const };
    queryPostgres.mockResolvedValueOnce({ rows: [adminRow] });

    await expect(
      upsertAdminUser({ name: "Admin", email: "ADMIN@EXAMPLE.COM", passwordHash: "hash" })
    ).resolves.toMatchObject({
      role: "admin",
      email: "admin@example.com"
    });
    expect(queryPostgres).toHaveBeenCalledWith("users.upsertAdmin", [
      "Admin",
      "admin@example.com",
      "hash"
    ]);
  });

  it("maps admin aggregate stats", async () => {
    queryPostgres.mockResolvedValueOnce({
      rows: [
        {
          user_count: 4,
          job_count: 9,
          job_posting_count: 2,
          completed_job_count: 6,
          failed_job_count: 1
        }
      ]
    });

    await expect(getAdminStats()).resolves.toEqual({
      userCount: 4,
      jobCount: 9,
      jobPostingCount: 2,
      completedJobCount: 6,
      failedJobCount: 1
    });
  });
});
