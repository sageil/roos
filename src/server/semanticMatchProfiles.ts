import { config } from "./config.js";
import { queryPostgres } from "./database.js";
import { createEmbeddings } from "./embeddings.js";
import { toPgVectorLiteral } from "./vector.js";

type SourceRow = {
  profile_text: string | null;
};

type MatchRow = {
  score: number;
  [column: string]: number;
};

export type SemanticProfileMatch = {
  id: number;
  score: number;
};

export const refreshSemanticMatchProfile = async ({
  entityId,
  sourceQuery,
  upsertQuery
}: {
  entityId: number;
  sourceQuery: string;
  upsertQuery: string;
}): Promise<void> => {
  const sourceResult = await queryPostgres<SourceRow>(sourceQuery, [entityId]);
  const profileText = sourceResult.rows[0]?.profile_text?.trim();

  if (!profileText) {
    return;
  }

  const [embedding] = await createEmbeddings([profileText]);

  await queryPostgres(upsertQuery, [
    entityId,
    profileText,
    toPgVectorLiteral(embedding),
    config.embeddingModel
  ]);
};

export const matchSemanticProfiles = async ({
  search,
  limit = 50,
  matchQuery,
  idColumn
}: {
  search: string;
  limit?: number;
  matchQuery: string;
  idColumn: string;
}): Promise<SemanticProfileMatch[]> => {
  const trimmedSearch = search.trim();
  if (!trimmedSearch) {
    return [];
  }

  const [embedding] = await createEmbeddings([trimmedSearch]);
  const result = await queryPostgres<MatchRow>(matchQuery, [
    toPgVectorLiteral(embedding),
    config.embeddingModel,
    limit
  ]);

  return result.rows.map((row) => ({
    id: row[idColumn],
    score: row.score
  }));
};
