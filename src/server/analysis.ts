import { z } from "zod";
import { createHash } from "node:crypto";
import type { EvidenceChunk, FairnessReview, RequirementAssessment, ResumeAnalysis, ScoreBreakdown } from "../shared/types.js";
import { chunkResumeText } from "./chunking.js";
import { config } from "./config.js";
import { cosineSimilarity, createEmbeddings } from "./embeddings.js";
import { createLlmClient } from "./openaiClients.js";
import { getCachedAnalysis, queryJobEvidence, storeResumeChunks, upsertCachedAnalysis } from "./postgresStore.js";

const analysisSchema = z.object({
  candidateSummary: z.string(),
  fitScore: z.number().min(0).max(100),
  fitLevel: z.enum(["low", "medium", "high"]),
  strengths: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  suggestedKeywords: z.array(z.string()).default([]),
  interviewQuestions: z.array(z.string()).default([]),
  requirementAssessments: z.array(z.object({
    category: z.enum(["minimum", "technical", "domain", "preferred", "seniority"]),
    requirement: z.string(),
    importance: z.enum(["must_have", "preferred"]),
    status: z.enum(["met", "partially_met", "not_evidenced"]),
    evidence: z.array(z.string()).default([]),
    rationale: z.string()
  })).default([]),
  scoreBreakdown: z.object({
    minimumQualifications: z.number().min(0).max(100),
    technicalCompetencies: z.number().min(0).max(100),
    domainExperience: z.number().min(0).max(100),
    preferredQualifications: z.number().min(0).max(100),
    seniorityScope: z.number().min(0).max(100),
    evidenceQuality: z.number().min(0).max(100)
  }).optional(),
  fairnessReview: z.object({
    ignoredFactors: z.array(z.string()).default([]),
    notes: z.array(z.string()).default([])
  }).optional()
});

const analysisCacheVersion = "2026-06-14-hr-structured-rubric-v1";

const stringArraySchema = {
  type: "array",
  items: { type: "string" }
};

const requirementAssessmentSchema = {
  type: "object",
  additionalProperties: false,
  required: ["category", "requirement", "importance", "status", "evidence", "rationale"],
  properties: {
    category: { type: "string", enum: ["minimum", "technical", "domain", "preferred", "seniority"] },
    requirement: { type: "string" },
    importance: { type: "string", enum: ["must_have", "preferred"] },
    status: { type: "string", enum: ["met", "partially_met", "not_evidenced"] },
    evidence: stringArraySchema,
    rationale: { type: "string" }
  }
};

const scoreBreakdownSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "minimumQualifications",
    "technicalCompetencies",
    "domainExperience",
    "preferredQualifications",
    "seniorityScope",
    "evidenceQuality"
  ],
  properties: {
    minimumQualifications: { type: "number", minimum: 0, maximum: 100 },
    technicalCompetencies: { type: "number", minimum: 0, maximum: 100 },
    domainExperience: { type: "number", minimum: 0, maximum: 100 },
    preferredQualifications: { type: "number", minimum: 0, maximum: 100 },
    seniorityScope: { type: "number", minimum: 0, maximum: 100 },
    evidenceQuality: { type: "number", minimum: 0, maximum: 100 }
  }
};

const fairnessReviewSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ignoredFactors", "notes"],
  properties: {
    ignoredFactors: stringArraySchema,
    notes: stringArraySchema
  }
};

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
        "interviewQuestions",
        "requirementAssessments",
        "scoreBreakdown",
        "fairnessReview"
      ],
      properties: {
        candidateSummary: { type: "string" },
        fitScore: { type: "number", minimum: 0, maximum: 100 },
        fitLevel: { type: "string", enum: ["low", "medium", "high"] },
        strengths: stringArraySchema,
        gaps: stringArraySchema,
        risks: stringArraySchema,
        recommendations: stringArraySchema,
        suggestedKeywords: stringArraySchema,
        interviewQuestions: stringArraySchema,
        requirementAssessments: {
          type: "array",
          items: requirementAssessmentSchema
        },
        scoreBreakdown: scoreBreakdownSchema,
        fairnessReview: fairnessReviewSchema
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

const normalizeForCache = (value: string | undefined): string =>
  (value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const buildAnalysisCacheIdentity = (
  resumeText: string,
  jobTitle: string,
  jobDescription?: string
) => {
  const resumeHash = sha256(normalizeForCache(resumeText));
  const jobProfileHash = sha256(
    JSON.stringify({
      title: normalizeForCache(jobTitle),
      description: normalizeForCache(jobDescription)
    })
  );
  const cacheKey = sha256(
    JSON.stringify({
      resumeHash,
      jobProfileHash,
      analysisCacheVersion,
      llmModel: config.llmModel,
      embeddingModel: config.embeddingModel
    })
  );

  return { cacheKey, resumeHash, jobProfileHash };
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
  "You are an HR talent assessment analyst supporting structured resume screening. Return only concise JSON. Evaluate the resume against job-related competencies, minimum qualifications, technical/domain requirements, preferred qualifications, and seniority/scope. Use only job-relevant evidence in the resume. Do not infer or use protected traits or demographic proxies such as name, age, address, gender, race, ethnicity, religion, disability, family status, nationality, school prestige, hobbies, or cultural markers. Do not make a hiring decision; provide a structured assessment for human review. Do not invent credentials.";

const userPrompt = (
  jobTitle: string,
  jobDescription: string | undefined,
  resumeText: string,
  evidence: EvidenceChunk[]
) => `Perform a structured HR resume screen for this job profile.

Job title:
${jobTitle}

Job description:
${jobDescription?.trim() || "Not provided. Infer expected qualifications from the target role."}

Top resume evidence selected by semantic retrieval:
${evidence.map((chunk) => `[chunk ${chunk.id}, score ${chunk.score}]\n${chunk.text}`).join("\n\n")}

Full resume text:
${resumeText.slice(0, 18000)}

Scoring rubric:
- First identify the job-related assessment criteria from the job profile.
- Separate criteria into minimum qualifications, required technical competencies, required domain/industry experience, preferred qualifications, and seniority/scope expectations.
- Evaluate each criterion using only resume evidence. If a requirement is not directly supported, mark it not_evidenced.
- Treat must-have requirements as materially more important than preferred qualifications.
- 90-100: exceptional fit; all or nearly all must-have requirements are directly evidenced, seniority/scope align, and preferred qualifications are strong.
- 80-89: strong fit; most must-have requirements are directly evidenced, no major minimum-qualification gaps, and only limited preferred/scope gaps remain.
- 60-79: partial fit; some must-have requirements are evidenced, but material gaps, weak evidence, or seniority/scope mismatches remain.
- 40-59: weak fit; only adjacent experience is evidenced or several core must-have requirements are missing.
- 0-39: poor fit; little direct evidence supports the target job profile.
- Do not reward years of experience unless the experience directly supports the job profile.
- Do not penalize or reward protected traits, identity markers, address/location clues, names, school prestige, hobbies, or cultural markers unless explicitly job-required and legally relevant.
- Use the same score for the same resume and job profile.

Return JSON with exactly these keys:
candidateSummary: string, summarize resume-to-job-profile fitness and the main reason for the score
fitScore: number from 0 to 100
fitLevel: "low" | "medium" | "high"
strengths: string[], resume evidence that matches the job profile
gaps: string[], important job requirements not clearly supported by the resume
risks: string[]
recommendations: string[], candidate-facing resume or positioning changes to improve fit for this job profile
suggestedKeywords: string[], missing or under-emphasized job-profile keywords the candidate can truthfully add
interviewQuestions: string[], questions a hiring team might ask to verify claimed fit
requirementAssessments: array of requirement assessments with category, requirement, importance, status, evidence, and rationale
scoreBreakdown: object with minimumQualifications, technicalCompetencies, domainExperience, preferredQualifications, seniorityScope, and evidenceQuality scores from 0 to 100
fairnessReview: object with ignoredFactors and notes explaining which non-job-related factors were ignored`;

const analyzeWithResponsesApi = async (prompt: string): Promise<string> => {
  const client = createLlmClient();
  const response = await client.responses.create({
    model: config.llmModel,
    instructions: systemPrompt,
    input: prompt,
    temperature: 0,
    top_p: 1
  });

  return response.output_text;
};

const analyzeWithChatCompletions = async (prompt: string): Promise<string> => {
  const client = createLlmClient();
  const response = await client.chat.completions.create({
    model: config.llmModel,
    temperature: 0,
    top_p: 1,
    response_format: analysisResponseFormat,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt }
    ]
  });

  return response.choices[0]?.message.content ?? "";
};

const fitLevelForScore = (score: number): ResumeAnalysis["fitLevel"] => {
  if (score >= 80) {
    return "high";
  }
  if (score >= 60) {
    return "medium";
  }
  return "low";
};

const normalizeAnalysis = (
  analysis: Omit<ResumeAnalysis, "evidence">,
  evidence: EvidenceChunk[]
): ResumeAnalysis => {
  const fitScore = Math.round(analysis.fitScore);
  const requirementAssessments: RequirementAssessment[] = analysis.requirementAssessments ?? [];
  const scoreBreakdown: ScoreBreakdown = analysis.scoreBreakdown ?? {
    minimumQualifications: fitScore,
    technicalCompetencies: fitScore,
    domainExperience: fitScore,
    preferredQualifications: fitScore,
    seniorityScope: fitScore,
    evidenceQuality: fitScore
  };
  const fairnessReview: FairnessReview = analysis.fairnessReview ?? {
    ignoredFactors: [],
    notes: ["Legacy analysis did not include a structured fairness review."]
  };

  return {
    ...analysis,
    fitScore,
    fitLevel: fitLevelForScore(fitScore),
    requirementAssessments,
    scoreBreakdown,
    fairnessReview,
    evidence
  };
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
  const cacheIdentity = buildAnalysisCacheIdentity(resumeText, jobTitle, jobDescription);
  const cached = await getCachedAnalysis(cacheIdentity.cacheKey);
  if (cached) {
    return {
      analysis: normalizeAnalysis(cached.analysis, evidence),
      chunkCount
    };
  }

  const prompt = userPrompt(jobTitle, jobDescription, resumeText, evidence);
  const text =
    config.llmApiStyle === "chat"
      ? await analyzeWithChatCompletions(prompt)
      : await analyzeWithResponsesApi(prompt);
  const parsed = analysisSchema.parse(extractJson(text));
  const analysis = normalizeAnalysis(parsed, evidence);

  await upsertCachedAnalysis({
    ...cacheIdentity,
    analysis,
    chunkCount
  });

  return {
    analysis,
    chunkCount
  };
};
