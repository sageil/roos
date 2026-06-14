import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryPostgres } = vi.hoisted(() => ({
  queryPostgres: vi.fn()
}));

vi.mock("../../src/server/database.js", () => ({
  queryPostgres
}));

vi.mock("../../src/server/sql.js", () => ({
  queries: {
    resumeVersions: {
      create: "resumeVersions.create",
      listForUser: "resumeVersions.listForUser"
    }
  }
}));

import {
  createResumeVersion,
  listResumeVersions
} from "../../src/server/resumeVersionStore.js";

const resumeVersionRow = {
  id: 3,
  user_id: 7,
  version_number: 2,
  file_name: "resume.pdf",
  content_type: "application/pdf",
  character_count: 4200,
  created_at: "2026-06-14T12:00:00.000Z"
};

describe("resumeVersionStore", () => {
  beforeEach(() => {
    queryPostgres.mockReset();
  });

  it("creates a versioned resume record", async () => {
    queryPostgres.mockResolvedValueOnce({ rows: [resumeVersionRow] });

    await expect(
      createResumeVersion({
        userId: 7,
        fileName: "resume.pdf",
        contentType: "application/pdf",
        characterCount: 4200,
        resumeText: "resume text"
      })
    ).resolves.toEqual({
      id: 3,
      userId: 7,
      versionNumber: 2,
      fileName: "resume.pdf",
      contentType: "application/pdf",
      characterCount: 4200,
      createdAt: "2026-06-14T12:00:00.000Z"
    });
    expect(queryPostgres).toHaveBeenCalledWith("resumeVersions.create", [
      7,
      "resume.pdf",
      "application/pdf",
      4200,
      "resume text"
    ]);
  });

  it("stores missing content type as null", async () => {
    queryPostgres.mockResolvedValueOnce({
      rows: [{ ...resumeVersionRow, content_type: null }]
    });

    await expect(
      createResumeVersion({
        userId: 7,
        fileName: "resume.txt",
        characterCount: 1200,
        resumeText: "resume text"
      })
    ).resolves.toMatchObject({
      contentType: undefined
    });
    expect(queryPostgres).toHaveBeenCalledWith("resumeVersions.create", [
      7,
      "resume.txt",
      null,
      1200,
      "resume text"
    ]);
  });

  it("lists resume versions for a user", async () => {
    queryPostgres.mockResolvedValueOnce({ rows: [resumeVersionRow] });

    await expect(listResumeVersions(7)).resolves.toEqual([
      {
        id: 3,
        userId: 7,
        versionNumber: 2,
        fileName: "resume.pdf",
        contentType: "application/pdf",
        characterCount: 4200,
        createdAt: "2026-06-14T12:00:00.000Z"
      }
    ]);
    expect(queryPostgres).toHaveBeenCalledWith("resumeVersions.listForUser", [7]);
  });
});
