import { queries } from "./sql.js";
import { matchSemanticProfiles, refreshSemanticMatchProfile } from "./semanticMatchProfiles.js";

export type JobPostingMatchProfileResult = {
  jobPostingId: number;
  score: number;
};

export const refreshJobPostingMatchProfile = (jobPostingId: number): Promise<void> =>
  refreshSemanticMatchProfile({
    entityId: jobPostingId,
    sourceQuery: queries.jobPostingMatchProfiles.source,
    upsertQuery: queries.jobPostingMatchProfiles.upsert
  });

export const matchJobPostingsBySemanticQuery = async (
  search: string,
  limit = 50
): Promise<JobPostingMatchProfileResult[]> => {
  const matches = await matchSemanticProfiles({
    search,
    limit,
    matchQuery: queries.jobPostingMatchProfiles.match,
    idColumn: "job_posting_id"
  });

  return matches.map((match) => ({
    jobPostingId: match.id,
    score: match.score
  }));
};
