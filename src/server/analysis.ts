import { z } from "zod";
import type { EvidenceChunk, ResumeAnalysis } from "../shared/types.js";
import { chunkResumeText } from "./chunking.js";
import { config } from "./config.js";
import { cosineSimilarity, createEmbeddings } from "./embeddings.js";
import { createLlmClient } from "./openaiClients.js";
import { queryJobEvidence, storeResumeChunks } from "./postgresStore.js";

const analysisSchema = z.object({
  candidateSummary: z.string(),
  fitScore: z.number().min(0).max(100),
  fitLevel: z.enum(["low", "medium", "high"]),
  strengths: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  suggestedKeywords: z.array(z.string()).default([]),
  interviewQuestions: z.array(z.string()).default([])
});

const analysisResponseFormat = {
  type: "json_schema" as const,
  json_schema: {
    name: "resume_analysis",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: [
        "candidateSummary",
        "fitScore",
        "fitLevel",
        "strengths",
        "gaps",
        "risks",
        "recommendations",
        "suggestedKeywords",
        "interviewQuestions"
      ],
      properties: {
        candidateSummary: { type: "string" },
        fitScore: { type: "number", minimum: 0, maximum: 100 },
        fitLevel: { type: "string", enum: ["low", "medium", "high"] },
        strengths: { type: "array", items: { type: "string" } },
        gaps: { type: "array", items: { type: "string" } },
        risks: { type: "array", items: { type: "string" } },
        recommendations: { type: "array", items: { type: "string" } },
        suggestedKeywords: { type: "array", items: { type: "string" } },
        interviewQuestions: { type: "array", items: { type: "string" } }
      }
    }
  }
};

const extractJson = (text: string): unknown => {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("The model did not return valid JSON.");
    }
    return JSON.parse(match[0]);
  }
};

const buildSearchQuery = (jobTitle: string, jobDescription?: string): string => {
  if (jobDescription?.trim()) {
    return `Resume evidence for this job title:\n${jobTitle}\n\nJob description:\n${jobDescription}`;
  }

  return `Resume evidence for a strong ${jobTitle} candidate, including relevant skills, impact, scope, tools, and progression.`;
};

const rankEvidence = async (
  jobId: number,
  applicationDate: string,
  resumeText: string,
  jobTitle: string,
  jobDescription?: string
): Promise<{ evidence: EvidenceChunk[]; chunkCount: number }> => {
  const chunks = chunkResumeText(resumeText);
  if (chunks.length === 0) {
    throw new Error("No readable resume text was found.");
  }

  const embeddings = await createEmbeddings([buildSearchQuery(jobTitle, jobDescription), ...chunks.map((chunk) => chunk.text)]);
  const queryEmbedding = embeddings[0];
  const chunkEmbeddings = embeddings.slice(1);

  await storeResumeChunks({
    jobId,
    applicationDate,
    jobTitle,
    chunks,
    embeddings: chunkEmbeddings
  });

  const evidenceFromPostgres = await queryJobEvidence({
    jobId,
    queryEmbedding,
    nResults: Math.min(7, chunks.length)
  });

  const fallbackEvidence = chunks
    .map((chunk, index) => ({
      id: chunk.id,
      text: chunk.text,
      score: Number(cosineSimilarity(queryEmbedding, chunkEmbeddings[index]).toFixed(4))
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 7);

  return {
    evidence: evidenceFromPostgres.length > 0 ? evidenceFromPostgres : fallbackEvidence,
    chunkCount: chunks.length
  };
};

const systemPrompt =
  "You are a resume-to-job-fit analyst for the candidate. Return only concise JSON. Evaluate how well the uploaded resume matches the target job profile. Be specific, evidence-based, and fair. Do not write advice for an interviewer or recruiter. Do not invent credentials.";

const userPrompt = (
  jobTitle: string,
  jobDescription: string | undefined,
  resumeText: string,
  evidence: EvidenceChunk[]
) => `Analyze this resume for the job title.

Job title:
${jobTitle}

Job description:
${jobDescription?.trim() || "Not provided. Infer expected qualifications from the target role."}

Top resume evidence selected by embedding similarity:
${evidence.map((chunk) => `[chunk ${chunk.id}, score ${chunk.score}]\n${chunk.text}`).join("\n\n")}

Full resume text:
${resumeText.slice(0, 18000)}

Return JSON with exactly these keys:
candidateSummary: string, summarize resume-to-job-profile fitness and the main reason for the score
fitScore: number from 0 to 100
fitLevel: "low" | "medium" | "high"
strengths: string[], resume evidence that matches the job profile
gaps: string[], important job requirements not clearly supported by the resume
risks: string[]
recommendations: string[], candidate-facing resume or positioning changes to improve fit for this job profile
suggestedKeywords: string[], missing or under-emphasized job-profile keywords the candidate can truthfully add
interviewQuestions: string[], questions a hiring team might ask to verify claimed fit`;

const analyzeWithResponsesApi = async (prompt: string): Promise<string> => {
  const client = createLlmClient();
  const response = await client.responses.create({
    model: config.llmModel,
    instructions: systemPrompt,
    input: prompt
  });

  return response.output_text;
};

const analyzeWithChatCompletions = async (prompt: string): Promise<string> => {
  const client = createLlmClient();
  const response = await client.chat.completions.create({
    model: config.llmModel,
    response_format: analysisResponseFormat,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt }
    ]
  });

  return response.choices[0]?.message.content ?? "";
};

export const analyzeResume = async (
  jobId: number,
  applicationDate: string,
  resumeText: string,
  jobTitle: string,
  jobDescription?: string
): Promise<{ analysis: ResumeAnalysis; chunkCount: number }> => {
  const { evidence, chunkCount } = await rankEvidence(
    jobId,
    applicationDate,
    resumeText,
    jobTitle,
    jobDescription
  );
  const prompt = userPrompt(jobTitle, jobDescription, resumeText, evidence);
  const text =
    config.llmApiStyle === "chat"
      ? await analyzeWithChatCompletions(prompt)
      : await analyzeWithResponsesApi(prompt);
  const parsed = analysisSchema.parse(extractJson(text));

  return {
    analysis: {
      ...parsed,
      fitScore: Math.round(parsed.fitScore),
      evidence
    },
    chunkCount
  };
};
