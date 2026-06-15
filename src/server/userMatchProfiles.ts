import { config } from "./config.js";
import { queryPostgres } from "./database.js";
import { createEmbeddings } from "./embeddings.js";
import { queries } from "./sql.js";

type UserMatchProfileSourceRow = {
  profile_text: string | null;
};

type UserMatchRow = {
  user_id: number;
  score: number;
};

export type UserMatchProfileResult = {
  userId: number;
  score: number;
};

const vectorLiteral = (embedding: number[]) => `[${embedding.join(",")}]`;

export const refreshUserMatchProfile = async (userId: number): Promise<void> => {
  const sourceResult = await queryPostgres<UserMatchProfileSourceRow>(
    queries.userMatchProfiles.source,
    [userId]
  );
  const profileText = sourceResult.rows[0]?.profile_text?.trim();

  if (!profileText) {
    return;
  }

  const [embedding] = await createEmbeddings([profileText]);

  await queryPostgres(queries.userMatchProfiles.upsert, [
    userId,
    profileText,
    vectorLiteral(embedding),
    config.embeddingModel
  ]);
};

export const matchAdminUsersBySemanticQuery = async (
  search: string,
  limit = 50
): Promise<UserMatchProfileResult[]> => {
  const trimmedSearch = search.trim();
  if (!trimmedSearch) {
    return [];
  }

  const [embedding] = await createEmbeddings([trimmedSearch]);
  const result = await queryPostgres<UserMatchRow>(queries.userMatchProfiles.match, [
    vectorLiteral(embedding),
    config.embeddingModel,
    limit
  ]);

  return result.rows.map((row) => ({
    userId: row.user_id,
    score: row.score
  }));
};
