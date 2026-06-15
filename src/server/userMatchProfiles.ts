import { queries } from "./sql.js";
import { matchSemanticProfiles, refreshSemanticMatchProfile } from "./semanticMatchProfiles.js";

export type UserMatchProfileResult = {
  userId: number;
  score: number;
};

export const refreshUserMatchProfile = (userId: number): Promise<void> =>
  refreshSemanticMatchProfile({
    entityId: userId,
    sourceQuery: queries.userMatchProfiles.source,
    upsertQuery: queries.userMatchProfiles.upsert
  });

export const matchAdminUsersBySemanticQuery = async (
  search: string,
  limit = 50
): Promise<UserMatchProfileResult[]> => {
  const matches = await matchSemanticProfiles({
    search,
    limit,
    matchQuery: queries.userMatchProfiles.match,
    idColumn: "user_id"
  });

  return matches.map((match) => ({
    userId: match.id,
    score: match.score
  }));
};
