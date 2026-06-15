import type { JobPostingRecord } from "../shared/types.js";
import { queryPostgres } from "./database.js";
import { queries } from "./sql.js";

type JobPostingRow = {
  id: number;
  created_by_user_id: number | null;
  title: string;
  description: string;
  skills: string[];
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
  match_count?: number;
  average_fit_score?: number;
  top_fit_score?: number;
};

const mapJobPostingRow = (row: JobPostingRow): JobPostingRecord => ({
  id: row.id,
  createdByUserId: row.created_by_user_id ?? undefined,
  title: row.title,
  description: row.description,
  skills: row.skills,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  matchCount: row.match_count,
  averageFitScore: row.average_fit_score,
  topFitScore: row.top_fit_score
});

export const createJobPosting = async ({
  createdByUserId,
  title,
  description,
  skills
}: {
  createdByUserId: number;
  title: string;
  description: string;
  skills: string[];
}): Promise<JobPostingRecord> => {
  const result = await queryPostgres<JobPostingRow>(queries.jobPostings.create, [
    createdByUserId,
    title,
    description,
    skills
  ]);

  return mapJobPostingRow(result.rows[0]);
};

export const listJobPostings = async ({
  includeArchived = false,
  search = "",
  semanticJobPostingIds = [],
  limit = 100
}: {
  includeArchived?: boolean;
  search?: string;
  semanticJobPostingIds?: number[];
  limit?: number;
} = {}): Promise<JobPostingRecord[]> => {
  const result = await queryPostgres<JobPostingRow>(queries.jobPostings.list, [
    includeArchived,
    search.trim(),
    semanticJobPostingIds,
    limit
  ]);
  return result.rows.map(mapJobPostingRow);
};

export const getActiveJobPosting = async (id: number): Promise<JobPostingRecord | undefined> => {
  const result = await queryPostgres<JobPostingRow>(queries.jobPostings.getActive, [id]);
  return result.rows[0] ? mapJobPostingRow(result.rows[0]) : undefined;
};
