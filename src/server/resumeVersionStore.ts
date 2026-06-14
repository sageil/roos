import type { ResumeVersionRecord } from "../shared/types.js";
import { queryPostgres } from "./database.js";
import { queries } from "./sql.js";

type ResumeVersionRow = {
  id: number;
  user_id: number;
  version_number: number;
  file_name: string;
  content_type: string | null;
  character_count: number;
  created_at: string;
};

const mapResumeVersionRow = (row: ResumeVersionRow): ResumeVersionRecord => ({
  id: row.id,
  userId: row.user_id,
  versionNumber: row.version_number,
  fileName: row.file_name,
  contentType: row.content_type ?? undefined,
  characterCount: row.character_count,
  createdAt: row.created_at
});

export const createResumeVersion = async ({
  userId,
  fileName,
  contentType,
  characterCount,
  resumeText
}: {
  userId: number;
  fileName: string;
  contentType?: string;
  characterCount: number;
  resumeText: string;
}): Promise<ResumeVersionRecord> => {
  const result = await queryPostgres<ResumeVersionRow>(queries.resumeVersions.create, [
    userId,
    fileName,
    contentType || null,
    characterCount,
    resumeText
  ]);

  return mapResumeVersionRow(result.rows[0]);
};

export const listResumeVersions = async (userId: number): Promise<ResumeVersionRecord[]> => {
  const result = await queryPostgres<ResumeVersionRow>(queries.resumeVersions.listForUser, [userId]);
  return result.rows.map(mapResumeVersionRow);
};
