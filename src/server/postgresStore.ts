import type { EvidenceChunk, JobRecord, ResumeAnalysis } from "../shared/types.js";
import type { TextChunk } from "./chunking.js";
import { config } from "./config.js";
import { checkPostgres, connectPostgres, queryPostgres, withPostgres } from "./database.js";
import { queries } from "./sql.js";

export { checkPostgres };

type JobStatus = "running" | "completed" | "failed";

type JobRow = {
  id: number;
  user_id: number | null;
  job_posting_id: number | null;
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
  analysis_json: string | null;
  error_message: string | null;
  llm_model: string | null;
  embedding_model: string | null;
  created_at: string;
  updated_at: string;
};

type EvidenceRow = {
  chunk_id: number;
  document: string;
  score: number;
};

const vectorLiteral = (embedding: number[]) => `[${embedding.join(",")}]`;

const parseAnalysis = (analysisJson: string | null): ResumeAnalysis | undefined => {
  if (!analysisJson) {
    return undefined;
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
  llmModel: row.llm_model ?? undefined,
  embeddingModel: row.embedding_model ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const createJob = async ({
  userId,
  jobPostingId,
  applicationDate,
  jobTitle,
  jobDescription,
  resumeFileName,
  characterCount
}: {
  userId: number;
  jobPostingId?: number;
  applicationDate: string;
  jobTitle: string;
  jobDescription?: string;
  resumeFileName: string;
  characterCount: number;
}): Promise<number> =>
  withPostgres(async () => {
    const result = await queryPostgres<{ id: string }>(
      queries.jobs.create,
      [
        userId,
        jobPostingId ?? null,
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
  chunkCount
}: {
  id: number;
  analysis: ResumeAnalysis;
  chunkCount: number;
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
        config.llmModel,
        config.embeddingModel,
        id
      ]
    );
  });

export const failJob = async (id: number, message: string) =>
  withPostgres(async () => {
    await queryPostgres(queries.jobs.fail, [message, id]);
  });

export const listJobs = async ({
  userId,
  role,
  limit = 20
}: {
  userId: number;
  role: "user" | "admin";
  limit?: number;
}): Promise<JobRecord[]> =>
  withPostgres(async () => {
    const result = role === "admin"
      ? await queryPostgres<JobRow>(queries.jobs.listAll, [limit])
      : await queryPostgres<JobRow>(queries.jobs.listForUser, [userId, limit]);

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
  embeddings
}: {
  jobId: number;
  applicationDate: string;
  jobTitle: string;
  chunks: TextChunk[];
  embeddings: number[][];
}) =>
  withPostgres(async () => {
    const client = await connectPostgres();
    try {
      await client.query(queries.transactions.begin);
      for (const [index, chunk] of chunks.entries()) {
        await client.query(
          queries.resumeChunks.upsert,
          [
            jobId,
            chunk.id,
            chunk.text,
            vectorLiteral(embeddings[index]),
            applicationDate,
            jobTitle,
            config.embeddingModel
          ]
        );
      }
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
      [jobId, vectorLiteral(queryEmbedding), nResults]
    );

    return result.rows.map((row) => ({
      id: row.chunk_id,
      text: row.document,
      score: Number(row.score.toFixed(4))
    }));
  });
