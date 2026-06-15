import { createEmbeddings } from "./embeddings.js";
import { queryMatchingJobIds } from "./postgresStore.js";

export type ApplicationMatchResult = {
  jobId: number;
  score: number;
};

export const matchApplicationsBySemanticQuery = async ({
  search,
  userId,
  role,
  limit = 100
}: {
  search: string;
  userId: number;
  role: "user" | "admin";
  limit?: number;
}): Promise<ApplicationMatchResult[]> => {
  const trimmedSearch = search.trim();
  if (!trimmedSearch) {
    return [];
  }

  const [embedding] = await createEmbeddings([trimmedSearch]);
  return queryMatchingJobIds({
    queryEmbedding: embedding,
    userId,
    role,
    nResults: limit
  });
};
