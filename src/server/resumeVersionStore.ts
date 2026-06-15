import type { ResumeVersionRecord } from "../shared/types.js";
import { queryPostgres } from "./database.js";
import { queries } from "./sql.js";

type ResumeVersionRow = {
  id: number;
  user_id: number;
  version_number: number;
  file_name: string;
  content_type: string | null;
  file_size: number;
  character_count: number;
  created_at: string;
};

type ResumeVersionDownloadRow = Omit<ResumeVersionRow, "character_count" | "created_at"> & {
  file_bytes: Buffer;
};

type LatestResumeVersionRow = ResumeVersionRow & {
  resume_text: string;
};

const mapResumeVersionRow = (row: ResumeVersionRow): ResumeVersionRecord => ({
  id: row.id,
  userId: row.user_id,
  versionNumber: row.version_number,
  fileName: row.file_name,
  contentType: row.content_type ?? undefined,
  fileSize: row.file_size,
  characterCount: row.character_count,
  createdAt: row.created_at
});

export const createResumeVersion = async ({
  userId,
  fileName,
  contentType,
  fileSize,
  fileBytes,
  characterCount,
  resumeText
}: {
  userId: number;
  fileName: string;
  contentType?: string;
  fileSize: number;
  fileBytes: Buffer;
  characterCount: number;
  resumeText: string;
}): Promise<ResumeVersionRecord> => {
  const result = await queryPostgres<ResumeVersionRow>(queries.resumeVersions.create, [
    userId,
    fileName,
    contentType || null,
    fileSize,
    fileBytes,
    characterCount,
    resumeText
  ]);

  return mapResumeVersionRow(result.rows[0]);
};

export const listResumeVersions = async (userId: number): Promise<ResumeVersionRecord[]> => {
  const result = await queryPostgres<ResumeVersionRow>(queries.resumeVersions.listForUser, [userId]);
  return result.rows.map(mapResumeVersionRow);
};

export const getLatestResumeVersion = async (userId: number) => {
  const result = await queryPostgres<LatestResumeVersionRow>(queries.resumeVersions.latestForUser, [userId]);
  const row = result.rows[0];
  if (!row) {
    return undefined;
  }

  return {
    ...mapResumeVersionRow(row),
    resumeText: row.resume_text
  };
};

export const getResumeVersionDownload = async ({
  resumeId,
  userId,
  role
}: {
  resumeId: number;
  userId: number;
  role: "user" | "admin";
}) => {
  const result = await queryPostgres<ResumeVersionDownloadRow>(queries.resumeVersions.download, [
    resumeId,
    role,
    userId
  ]);
  const row = result.rows[0];
  if (!row) {
    return undefined;
  }

  return {
    id: row.id,
    userId: row.user_id,
    versionNumber: row.version_number,
    fileName: row.file_name,
    contentType: row.content_type ?? "application/octet-stream",
    fileSize: row.file_size,
    fileBytes: row.file_bytes
  };
};
