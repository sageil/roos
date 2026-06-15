import type { EvidenceChunk, JobRecord, ResumeAnalysis } from "../shared/types.js";
import type { TextChunk } from "./chunking.js";
import { config } from "./config.js";
import { checkPostgres, connectPostgres, queryPostgres, withPostgres } from "./database.js";
import { queries } from "./sql.js";
import { toPgVectorLiteral } from "./vector.js";

export { checkPostgres };

type JobStatus = "running" | "completed" | "failed";
export type JobAnalysisKind = "application" | "candidate_assessment";

type JobRow = {
  id: number;
  user_id: number | null;
  job_posting_id: number | null;
  analysis_kind?: JobAnalysisKind | null;
  job_posting_title: string | null;
  user_name: string | null;
  user_email: string | null;
  status: JobStatus;
  application_date: string;
  job_title: string;
  job_description: string | null;
  resume_file_name: string | null;
  character_count: number | null;
  chunk_count: number | null;
  llm_recommendation: string | null;
  fit_score: number | null;
  fit_level: "low" | "medium" | "high" | null;
  analysis_json: ResumeAnalysis | string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type EvidenceRow = {
  chunk_id: number;
  document: string;
  score: number | string | null;
};

type JobMatchRow = {
  job_id: number;
  score: number;
};

type ExistsRow = {
  exists: boolean;
};

type LatestApplicationRow = {
  id: number;
  created_at: string;
};

export type LatestApplicationForPosting = {
  id: number;
  createdAt: string;
};

type AnalysisCacheRow = {
  cache_key: string;
  resume_hash: string;
  job_profile_hash: string;
  llm_model: string;
  embedding_model: string;
  analysis_json: ResumeAnalysis | string;
  chunk_count: number;
  created_at: string;
  updated_at: string;
};

export type CachedAnalysis = {
  cacheKey: string;
  resumeHash: string;
  jobProfileHash: string;
  llmModel: string;
  embeddingModel: string;
  analysis: ResumeAnalysis;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
};

const parseAnalysis = (analysisJson: ResumeAnalysis | string | null): ResumeAnalysis | undefined => {
  if (!analysisJson) {
    return undefined;
  }

  if (typeof analysisJson !== "string") {
    return analysisJson;
  }

  try {
    return JSON.parse(analysisJson) as ResumeAnalysis;
  } catch {
    return undefined;
  }
};

const mapRow = (row: JobRow): JobRecord => ({
  id: row.id,
  userId: row.user_id ?? undefined,
  jobPostingId: row.job_posting_id ?? undefined,
  analysisKind: row.analysis_kind ?? "application",
  jobPostingTitle: row.job_posting_title ?? undefined,
  userName: row.user_name ?? undefined,
  userEmail: row.user_email ?? undefined,
  status: row.status,
  applicationDate: row.application_date,
  jobTitle: row.job_title,
  jobDescription: row.job_description ?? undefined,
  resumeFileName: row.resume_file_name ?? undefined,
  characterCount: row.character_count ?? undefined,
  chunkCount: row.chunk_count ?? undefined,
  llmRecommendation: row.llm_recommendation ?? undefined,
  analysis: parseAnalysis(row.analysis_json),
  fitScore: row.fit_score ?? undefined,
  fitLevel: row.fit_level ?? undefined,
  errorMessage: row.error_message ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const mapAnalysisCacheRow = (row: AnalysisCacheRow): CachedAnalysis | undefined => {
  const analysis = parseAnalysis(row.analysis_json);
  if (!analysis) {
    return undefined;
  }

  return {
    cacheKey: row.cache_key,
    resumeHash: row.resume_hash,
    jobProfileHash: row.job_profile_hash,
    llmModel: row.llm_model,
    embeddingModel: row.embedding_model,
    analysis,
    chunkCount: row.chunk_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const normalizeMatchScore = (score: number | string | null): number => {
  const numericScore = typeof score === "number" ? score : Number(score);
  return Number.isFinite(numericScore) ? Number(numericScore.toFixed(4)) : 0;
};

export const createJob = async ({
  userId,
  jobPostingId,
  applicationDate,
  jobTitle,
  jobDescription,
  resumeFileName,
  characterCount,
  analysisKind = "application"
}: {
  userId: number;
  jobPostingId?: number;
  applicationDate: string;
  jobTitle: string;
  jobDescription?: string;
  resumeFileName: string;
  characterCount: number;
  analysisKind?: JobAnalysisKind;
}): Promise<number> =>
  withPostgres(async () => {
    const result = await queryPostgres<{ id: string }>(
      queries.jobs.create,
      [
        userId,
        jobPostingId ?? null,
        analysisKind,
        applicationDate,
        jobTitle,
        jobDescription || null,
        resumeFileName,
        characterCount
      ]
    );

    return Number(result.rows[0].id);
  });

const buildRecommendation = (analysis: ResumeAnalysis): string => {
  if (analysis.recommendations.length > 0) {
    return analysis.recommendations.join("\n");
  }

  return analysis.candidateSummary;
};

export const completeJob = async ({
  id,
  analysis,
  chunkCount,
  llmModel = config.llmModel,
  embeddingModel = config.embeddingModel
}: {
  id: number;
  analysis: ResumeAnalysis;
  chunkCount: number;
  llmModel?: string;
  embeddingModel?: string;
}) =>
  withPostgres(async () => {
    await queryPostgres(
      queries.jobs.complete,
      [
        chunkCount,
        buildRecommendation(analysis),
        analysis.fitScore,
        analysis.fitLevel,
        JSON.stringify(analysis),
        llmModel,
        embeddingModel,
        id
      ]
    );
  });

export const failJob = async (id: number, message: string) =>
  withPostgres(async () => {
    await queryPostgres(queries.jobs.fail, [message, id]);
  });

export const convertJobToApplication = async (id: number) =>
  withPostgres(async () => {
    await queryPostgres(queries.jobs.convertToApplication, [id]);
  });

export const hasJobForUserPosting = async ({
  userId,
  jobPostingId
}: {
  userId: number;
  jobPostingId: number;
}): Promise<boolean> =>
  withPostgres(async () => {
    const result = await queryPostgres<ExistsRow>(
      queries.jobs.existsForUserPosting,
      [userId, jobPostingId]
    );

    return result.rows[0]?.exists ?? false;
  });

export const getLatestApplicationForUserPosting = async ({
  userId,
  jobPostingId
}: {
  userId: number;
  jobPostingId: number;
}): Promise<LatestApplicationForPosting | undefined> =>
  withPostgres(async () => {
    const result = await queryPostgres<LatestApplicationRow>(
      queries.jobs.latestForUserPosting,
      [userId, jobPostingId]
    );
    const row = result.rows[0];
    return row ? { id: row.id, createdAt: row.created_at } : undefined;
  });

export const updateJobInterviewQuestions = async ({
  id,
  interviewQuestions
}: {
  id: number;
  interviewQuestions: string[];
}) =>
  withPostgres(async () => {
    await queryPostgres(
      queries.jobs.updateInterviewQuestions,
      [id, JSON.stringify(interviewQuestions)]
    );
  });

export const listJobs = async ({
  userId,
  role,
  limit = 20,
  offset = 0
}: {
  userId: number;
  role: "user" | "admin";
  limit?: number;
  offset?: number;
}): Promise<JobRecord[]> =>
  withPostgres(async () => {
    const result = role === "admin"
      ? await queryPostgres<JobRow>(queries.jobs.listAll, [limit, offset])
      : await queryPostgres<JobRow>(queries.jobs.listForUser, [userId, limit, offset]);

    return result.rows.map(mapRow);
  });

export const listJobsForPosting = async ({
  jobPostingId,
  limit = 100,
  offset = 0
}: {
  jobPostingId: number;
  limit?: number;
  offset?: number;
}): Promise<JobRecord[]> =>
  withPostgres(async () => {
    const result = await queryPostgres<JobRow>(queries.jobs.listForPosting, [jobPostingId, limit, offset]);
    return result.rows.map(mapRow);
  });

export const searchJobs = async ({
  userId,
  role,
  search = "",
  semanticJobIds = [],
  limit = 100,
  offset = 0
}: {
  userId: number;
  role: "user" | "admin";
  search?: string;
  semanticJobIds?: number[];
  limit?: number;
  offset?: number;
}): Promise<JobRecord[]> =>
  withPostgres(async () => {
    const result = await queryPostgres<JobRow>(queries.jobs.search, [
      role,
      userId,
      search.trim(),
      semanticJobIds,
      limit,
      offset
    ]);

    return result.rows.map(mapRow);
  });

export const getJob = async ({
  id,
  userId,
  role
}: {
  id: number;
  userId: number;
  role: "user" | "admin";
}): Promise<JobRecord | undefined> =>
  withPostgres(async () => {
    const result = await queryPostgres<JobRow>(
      queries.jobs.get,
      [id, role === "admin" ? null : userId]
    );

    return result.rows[0] ? mapRow(result.rows[0]) : undefined;
  });

export const storeResumeChunks = async ({
  jobId,
  applicationDate,
  jobTitle,
  chunks,
  embeddings,
  embeddingModel = config.embeddingModel
}: {
  jobId: number;
  applicationDate: string;
  jobTitle: string;
  chunks: TextChunk[];
  embeddings: number[][];
  embeddingModel?: string;
}) =>
  withPostgres(async () => {
    if (chunks.length !== embeddings.length) {
      throw new Error("Chunk and embedding counts must match before storing resume evidence.");
    }

    if (chunks.length === 0) {
      return;
    }

    const client = await connectPostgres();
    try {
      await client.query(queries.transactions.begin);
      await client.query(
        queries.resumeChunks.upsertMany,
        [
          jobId,
          chunks.map((chunk) => chunk.id),
          chunks.map((chunk) => chunk.text),
          embeddings.map(toPgVectorLiteral),
          applicationDate,
          jobTitle,
          embeddingModel
        ]
      );
      await client.query(queries.transactions.commit);
    } catch (error) {
      await client.query(queries.transactions.rollback);
      throw error;
    } finally {
      client.release();
    }
  });

export const queryJobEvidence = async ({
  jobId,
  queryEmbedding,
  nResults
}: {
  jobId: number;
  queryEmbedding: number[];
  nResults: number;
}): Promise<EvidenceChunk[]> =>
  withPostgres(async () => {
    const result = await queryPostgres<EvidenceRow>(
      queries.resumeChunks.match,
      [jobId, toPgVectorLiteral(queryEmbedding), nResults]
    );

    return result.rows.map((row) => ({
      id: row.chunk_id,
      text: row.document,
      score: normalizeMatchScore(row.score)
    }));
  });

export const queryMatchingJobIds = async ({
  queryEmbedding,
  userId,
  role,
  nResults,
  embeddingModel = config.embeddingModel
}: {
  queryEmbedding: number[];
  userId: number;
  role: "user" | "admin";
  nResults: number;
  embeddingModel?: string;
}): Promise<{ jobId: number; score: number }[]> =>
  withPostgres(async () => {
    const result = await queryPostgres<JobMatchRow>(
      queries.resumeChunks.matchJobs,
      [toPgVectorLiteral(queryEmbedding), embeddingModel, role, userId, nResults]
    );

    return result.rows.map((row) => ({
      jobId: row.job_id,
      score: row.score
    }));
  });

export const getCachedAnalysis = async (cacheKey: string): Promise<CachedAnalysis | undefined> =>
  withPostgres(async () => {
    const result = await queryPostgres<AnalysisCacheRow>(queries.analysisCache.get, [cacheKey]);
    return result.rows[0] ? mapAnalysisCacheRow(result.rows[0]) : undefined;
  });

export const upsertCachedAnalysis = async ({
  cacheKey,
  resumeHash,
  jobProfileHash,
  analysis,
  chunkCount,
  llmModel = config.llmModel,
  embeddingModel = config.embeddingModel
}: {
  cacheKey: string;
  resumeHash: string;
  jobProfileHash: string;
  analysis: ResumeAnalysis;
  chunkCount: number;
  llmModel?: string;
  embeddingModel?: string;
}) =>
  withPostgres(async () => {
    await queryPostgres(queries.analysisCache.upsert, [
      cacheKey,
      resumeHash,
      jobProfileHash,
      llmModel,
      embeddingModel,
      JSON.stringify(analysis),
      chunkCount
    ]);
  });
