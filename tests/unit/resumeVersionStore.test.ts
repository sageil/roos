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
      download: "resumeVersions.download",
      listForUser: "resumeVersions.listForUser"
    }
  }
}));

import {
  createResumeVersion,
  getResumeVersionDownload,
  listResumeVersions
} from "../../src/server/resumeVersionStore.js";

const resumeVersionRow = {
  id: 3,
  user_id: 7,
  version_number: 2,
  file_name: "resume.pdf",
  content_type: "application/pdf",
  file_size: 1024,
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
        fileSize: 4,
        fileBytes: Buffer.from("%PDF"),
        characterCount: 4200,
        resumeText: "resume text"
      })
    ).resolves.toEqual({
      id: 3,
      userId: 7,
      versionNumber: 2,
      fileName: "resume.pdf",
      contentType: "application/pdf",
      fileSize: 1024,
      characterCount: 4200,
      createdAt: "2026-06-14T12:00:00.000Z"
    });
    expect(queryPostgres).toHaveBeenCalledWith("resumeVersions.create", [
      7,
      "resume.pdf",
      "application/pdf",
      4,
      Buffer.from("%PDF"),
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
        resumeText: "resume text",
        fileSize: 11,
        fileBytes: Buffer.from("resume text")
      })
    ).resolves.toMatchObject({
      contentType: undefined
    });
    expect(queryPostgres).toHaveBeenCalledWith("resumeVersions.create", [
      7,
      "resume.txt",
      null,
      11,
      Buffer.from("resume text"),
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
        fileSize: 1024,
        characterCount: 4200,
        createdAt: "2026-06-14T12:00:00.000Z"
      }
    ]);
    expect(queryPostgres).toHaveBeenCalledWith("resumeVersions.listForUser", [7]);
  });

  it("loads downloadable resume bytes for authorized users", async () => {
    queryPostgres.mockResolvedValueOnce({
      rows: [
        {
          id: 3,
          user_id: 7,
          version_number: 2,
          file_name: "resume.pdf",
          content_type: "application/pdf",
          file_size: 4,
          file_bytes: Buffer.from("%PDF")
        }
      ]
    });

    await expect(
      getResumeVersionDownload({ resumeId: 3, userId: 7, role: "user" })
    ).resolves.toMatchObject({
      id: 3,
      userId: 7,
      versionNumber: 2,
      fileName: "resume.pdf",
      contentType: "application/pdf",
      fileSize: 4,
      fileBytes: Buffer.from("%PDF")
    });
    expect(queryPostgres).toHaveBeenCalledWith("resumeVersions.download", [3, "user", 7]);
  });
});
