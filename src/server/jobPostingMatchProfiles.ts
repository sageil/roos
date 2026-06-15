import { config } from "./config.js";
import { queryPostgres } from "./database.js";
import { createEmbeddings } from "./embeddings.js";
import { queries } from "./sql.js";

type JobPostingMatchProfileSourceRow = {
  profile_text: string | null;
};

type JobPostingMatchRow = {
  job_posting_id: number;
  score: number;
};

export type JobPostingMatchProfileResult = {
  jobPostingId: number;
  score: number;
};

const vectorLiteral = (embedding: number[]) => `[${embedding.join(",")}]`;

export const refreshJobPostingMatchProfile = async (jobPostingId: number): Promise<void> => {
  const sourceResult = await queryPostgres<JobPostingMatchProfileSourceRow>(
    queries.jobPostingMatchProfiles.source,
    [jobPostingId]
  );
  const profileText = sourceResult.rows[0]?.profile_text?.trim();

  if (!profileText) {
    return;
  }

  const [embedding] = await createEmbeddings([profileText]);

  await queryPostgres(queries.jobPostingMatchProfiles.upsert, [
    jobPostingId,
    profileText,
    vectorLiteral(embedding),
    config.embeddingModel
  ]);
};

export const matchJobPostingsBySemanticQuery = async (
  search: string,
  limit = 50
): Promise<JobPostingMatchProfileResult[]> => {
  const trimmedSearch = search.trim();
  if (!trimmedSearch) {
    return [];
  }

  const [embedding] = await createEmbeddings([trimmedSearch]);
  const result = await queryPostgres<JobPostingMatchRow>(queries.jobPostingMatchProfiles.match, [
    vectorLiteral(embedding),
    config.embeddingModel,
    limit
  ]);

  return result.rows.map((row) => ({
    jobPostingId: row.job_posting_id,
    score: row.score
  }));
};
