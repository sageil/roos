import { z } from "zod";
import { createHash } from "node:crypto";
import type { AppSettings, EvidenceChunk, ResumeAnalysis } from "../shared/types.js";
import { getEffectiveAppSettings } from "./appSettingsStore.js";
import { chunkResumeText } from "./chunking.js";
import { cosineSimilarity, createEmbeddings } from "./embeddings.js";
import { createLlmClient } from "./openaiClients.js";
import { getCachedAnalysis, queryJobEvidence, storeResumeChunks, upsertCachedAnalysis } from "./postgresStore.js";

const analysisSchema = z.object({
  candidateSummary: z.string(),
  strengths: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  suggestedKeywords: z.array(z.string()).default([]),
  interviewQuestions: z.array(z.string()).default([]),
  requirementAssessments: z.array(z.object({
    category: z.enum(["minimum", "role_competency", "domain", "preferred", "seniority"]),
    requirement: z.string(),
    importance: z.enum(["must_have", "preferred"]),
    status: z.enum(["met", "partially_met", "not_evidenced"]),
    evidence: z.array(z.string()).default([]),
    rationale: z.string()
  })).default([]),
  scoreBreakdown: z.object({
    minimumQualifications: z.number().min(0).max(100),
    roleCompetencies: z.number().min(0).max(100),
    domainExperience: z.number().min(0).max(100),
    preferredQualifications: z.number().min(0).max(100),
    seniorityScope: z.number().min(0).max(100),
    evidenceQuality: z.number().min(0).max(100)
  }),
  fairnessReview: z.object({
    ignoredFactors: z.array(z.string()).default([]),
    notes: z.array(z.string()).default([])
  })
});

const analysisCacheVersion = "2026-06-14-deterministic-scoring-v1";

const stringArraySchema = {
  type: "array",
  items: { type: "string" }
};

const requirementAssessmentSchema = {
  type: "object",
  additionalProperties: false,
  required: ["category", "requirement", "importance", "status", "evidence", "rationale"],
  properties: {
    category: { type: "string", enum: ["minimum", "role_competency", "domain", "preferred", "seniority"] },
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
    "roleCompetencies",
    "domainExperience",
    "preferredQualifications",
    "seniorityScope",
    "evidenceQuality"
  ],
  properties: {
    minimumQualifications: { type: "number", minimum: 0, maximum: 100 },
    roleCompetencies: { type: "number", minimum: 0, maximum: 100 },
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
  settings: AppSettings,
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
      llmModel: settings.llmModel,
      embeddingModel: settings.embeddingModel
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
  settings: AppSettings,
  jobDescription?: string
): Promise<{ evidence: EvidenceChunk[]; chunkCount: number }> => {
  const chunks = chunkResumeText(resumeText);
  if (chunks.length === 0) {
    throw new Error("No readable resume text was found.");
  }

  const embeddings = await createEmbeddings([buildSearchQuery(jobTitle, jobDescription), ...chunks.map((chunk) => chunk.text)], settings);
  const queryEmbedding = embeddings[0];
  const chunkEmbeddings = embeddings.slice(1);

  await storeResumeChunks({
    jobId,
    applicationDate,
    jobTitle,
    chunks,
    embeddings: chunkEmbeddings,
    embeddingModel: settings.embeddingModel
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
  "You are an HR talent assessment analyst supporting structured resume screening across any industry. Return only concise JSON. Extract job-related requirements, evidence, gaps, risks, recommendations, and category-level assessments. Use only job-relevant evidence in the resume. Do not infer or use protected traits or demographic proxies such as name, age, address, gender, race, ethnicity, religion, disability, family status, nationality, school prestige, hobbies, or cultural markers. Do not make a hiring decision; provide a structured assessment for human review. Do not invent credentials. Do not provide the final fit score or fit label; the application computes those deterministically.";

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
- Separate criteria into minimum qualifications, required role competencies, required domain/industry/context experience, preferred qualifications, and seniority/scope expectations.
- Evaluate each criterion using only resume evidence. If a requirement is not directly supported, mark it not_evidenced.
- Treat must-have requirements as materially more important than preferred qualifications.
- Category scores are inputs to deterministic scoring, not the final score.
- 90-100 category score: direct, repeated evidence fully supports that category.
- 80-89 category score: strong evidence with only minor gaps.
- 60-79 category score: partial evidence with material gaps or weak specificity.
- 40-59 category score: adjacent evidence or several missing requirements.
- 0-39 category score: little direct evidence supports that category.
- Do not reward years of experience unless the experience directly supports the job profile.
- Do not penalize or reward protected traits, identity markers, address/location clues, names, school prestige, hobbies, or cultural markers unless explicitly job-required and legally relevant.
- Do not include an overall score or fit label.

Return JSON with exactly these keys:
candidateSummary: string, summarize resume-to-job-profile fitness and the main reason for the assessment
strengths: string[], resume evidence that matches the job profile
gaps: string[], important job requirements not clearly supported by the resume
risks: string[]
recommendations: string[], candidate-facing resume or positioning changes to improve fit for this job profile
suggestedKeywords: string[], missing or under-emphasized job-profile keywords the candidate can truthfully add
interviewQuestions: string[], questions a hiring team might ask to verify claimed fit
requirementAssessments: array of requirement assessments with category, requirement, importance, status, evidence, and rationale. Use category "role_competency" for role-specific competencies in any industry.
scoreBreakdown: object with minimumQualifications, roleCompetencies, domainExperience, preferredQualifications, seniorityScope, and evidenceQuality scores from 0 to 100
fairnessReview: object with ignoredFactors and notes explaining which non-job-related factors were ignored`;

const analyzeWithResponsesApi = async (prompt: string, settings: AppSettings): Promise<string> => {
  const client = createLlmClient(settings);
  const response = await client.responses.create({
    model: settings.llmModel,
    instructions: systemPrompt,
    input: prompt,
    temperature: 0,
    top_p: 1
  });

  return response.output_text;
};

const analyzeWithChatCompletions = async (prompt: string, settings: AppSettings): Promise<string> => {
  const client = createLlmClient(settings);
  const response = await client.chat.completions.create({
    model: settings.llmModel,
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

const clampScore = (score: number): number =>
  Math.max(0, Math.min(100, Math.round(score)));

const deterministicFitScore = (
  analysis: Omit<ResumeAnalysis, "fitScore" | "fitLevel" | "evidence">
): number => {
  const { scoreBreakdown, requirementAssessments } = analysis;
  const categoryScore =
    scoreBreakdown.minimumQualifications * 0.25 +
    scoreBreakdown.roleCompetencies * 0.3 +
    scoreBreakdown.domainExperience * 0.15 +
    scoreBreakdown.preferredQualifications * 0.1 +
    scoreBreakdown.seniorityScope * 0.1 +
    scoreBreakdown.evidenceQuality * 0.1;

  const mustHaveRequirements = requirementAssessments.filter(
    (requirement) => requirement.importance === "must_have"
  );
  const missingMustHaveCount = mustHaveRequirements.filter(
    (requirement) => requirement.status === "not_evidenced"
  ).length;
  const partialMustHaveCount = mustHaveRequirements.filter(
    (requirement) => requirement.status === "partially_met"
  ).length;
  const mustHaveCoverage = mustHaveRequirements.length === 0
    ? 1
    : mustHaveRequirements.reduce(
      (total, requirement) => {
        if (requirement.status === "met") {
          return total + 1;
        }
        if (requirement.status === "partially_met") {
          return total + 0.55;
        }
        return total;
      },
      0
    ) / mustHaveRequirements.length;
  const coverageAdjustedScore = categoryScore * 0.7 + mustHaveCoverage * 100 * 0.3;

  const mustHaveCategoryScores = mustHaveRequirements
    .map((requirement) => {
      switch (requirement.category) {
        case "minimum":
          return scoreBreakdown.minimumQualifications;
        case "role_competency":
          return scoreBreakdown.roleCompetencies;
        case "domain":
          return scoreBreakdown.domainExperience;
        case "preferred":
          return scoreBreakdown.preferredQualifications;
        case "seniority":
          return scoreBreakdown.seniorityScope;
      }
    });
  const weakestMustHaveCategory = mustHaveCategoryScores.length > 0
    ? Math.min(...mustHaveCategoryScores)
    : 100;
  const weakestCoreCategory = Math.min(
    scoreBreakdown.minimumQualifications,
    scoreBreakdown.roleCompetencies,
    weakestMustHaveCategory
  );

  let scoreCap = 100;
  if (missingMustHaveCount > 0) {
    scoreCap = Math.min(scoreCap, 59);
  }
  if (partialMustHaveCount > 0) {
    scoreCap = Math.min(scoreCap, 79);
  }
  if (partialMustHaveCount >= 2) {
    scoreCap = Math.min(scoreCap, 74);
  }
  if (mustHaveCoverage < 0.7) {
    scoreCap = Math.min(scoreCap, 69);
  }
  if (scoreBreakdown.minimumQualifications < 70) {
    scoreCap = Math.min(scoreCap, 79);
  }
  if (scoreBreakdown.roleCompetencies < 70) {
    scoreCap = Math.min(scoreCap, 79);
  }
  if (scoreBreakdown.evidenceQuality < 60) {
    scoreCap = Math.min(scoreCap, 69);
  }
  if (weakestCoreCategory < 80) {
    scoreCap = Math.min(scoreCap, weakestCoreCategory + 15);
  }

  return clampScore(Math.min(coverageAdjustedScore, scoreCap));
};

const normalizeAnalysis = (
  analysis: Omit<ResumeAnalysis, "fitScore" | "fitLevel" | "evidence">,
  evidence: EvidenceChunk[]
): ResumeAnalysis => {
  const fitScore = deterministicFitScore(analysis);

  return {
    ...analysis,
    fitScore,
    fitLevel: fitLevelForScore(fitScore),
    evidence
  };
};

export const analyzeResume = async (
  jobId: number,
  applicationDate: string,
  resumeText: string,
  jobTitle: string,
  jobDescription?: string,
  suppliedSettings?: AppSettings
): Promise<{ analysis: ResumeAnalysis; chunkCount: number }> => {
  const settings = suppliedSettings ?? await getEffectiveAppSettings();
  const { evidence, chunkCount } = await rankEvidence(
    jobId,
    applicationDate,
    resumeText,
    jobTitle,
    settings,
    jobDescription
  );
  const cacheIdentity = buildAnalysisCacheIdentity(resumeText, jobTitle, settings, jobDescription);
  const cached = await getCachedAnalysis(cacheIdentity.cacheKey);
  if (cached) {
    return {
      analysis: normalizeAnalysis(cached.analysis, evidence),
      chunkCount
    };
  }

  const prompt = userPrompt(jobTitle, jobDescription, resumeText, evidence);
  const text =
    settings.llmApiStyle === "chat"
      ? await analyzeWithChatCompletions(prompt, settings)
      : await analyzeWithResponsesApi(prompt, settings);
  const parsed = analysisSchema.parse(extractJson(text));
  const analysis = normalizeAnalysis(parsed, evidence);

  await upsertCachedAnalysis({
    ...cacheIdentity,
    analysis,
    chunkCount,
    llmModel: settings.llmModel,
    embeddingModel: settings.embeddingModel
  });

  return {
    analysis,
    chunkCount
  };
};
