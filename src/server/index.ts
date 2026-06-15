import cors from "cors";
import express from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { AnalyzeResponse, JobRecord, PrivacyRedactionSummary, ResumeAnalysis, UserRecord } from "../shared/types.js";
import { analyzeResume } from "./analysis.js";
import { matchApplicationsBySemanticQuery } from "./applicationSearch.js";
import { getEffectiveAppSettings, getPublicAppSettings, updateAppSettings } from "./appSettingsStore.js";
import { assessmentPdfFileName, buildAssessmentPdf } from "./assessmentPdf.js";
import { config } from "./config.js";
import { sendMeetingInvite } from "./emailService.js";
import { matchJobPostingsBySemanticQuery, refreshJobPostingMatchProfile } from "./jobPostingMatchProfiles.js";
import { createJobPosting, getActiveJobPosting, listJobPostings } from "./jobPostingStore.js";
import { hashPassword, verifyPassword } from "./passwords.js";
import { checkPostgres, completeJob, convertJobToApplication, createJob, failJob, getJob, getLatestApplicationForUserPosting, hasJobForUserPosting, listJobs, listJobsForPosting, searchJobs, updateJobInterviewQuestions, type JobAnalysisKind } from "./postgresStore.js";
import { detectResumePrivacy, redactResumePrivacy, type PrivacyRedactionInput } from "./privacyRedaction.js";
import { createResumeVersion, getLatestResumeVersion, getResumeVersionDownload, listResumeVersions } from "./resumeVersionStore.js";
import { createSession, deleteSession, findUserBySessionToken } from "./sessions.js";
import { buildSystemHealth, localInstanceHealth } from "./systemHealth.js";
import { extractResumeText } from "./textExtraction.js";
import { matchAdminUsersBySemanticQuery, refreshUserMatchProfile } from "./userMatchProfiles.js";
import {
  createUser,
  findUserByEmail,
  findUserById,
  getAdminStats,
  listAdminUserDetails,
  listUsers,
  updateUserProfile,
  updateUserPassword,
  upsertAdminUser
} from "./userStore.js";

const app = express();
app.disable("x-powered-by");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxUploadBytes,
    files: 1
  }
});

const minimumResumeTextLength = 80;
const duplicateApplicationMessage = "Upload a new resume version before applying to this role again.";

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date in YYYY-MM-DD format.");

const analyzeBodySchema = z.object({
  jobPostingId: z.coerce.number().int().positive().optional(),
  jobTitle: z.string().trim().optional(),
  targetRole: z.string().trim().optional(),
  applicationDate: dateOnlySchema,
  jobDescription: z.string().trim().optional(),
  privacyRedactions: z.string().optional()
}).transform((body) => {
  const jobTitle = body.jobTitle || body.targetRole;
  if (!body.jobPostingId && (!jobTitle || jobTitle.length < 2)) {
    throw new Error("Job title is required.");
  }

  return {
    jobPostingId: body.jobPostingId,
    jobTitle: jobTitle ?? "",
    applicationDate: body.applicationDate,
    jobDescription: body.jobDescription,
    privacyRedactions: body.privacyRedactions
  };
});

const analyzeStoredResumeBodySchema = z.object({
  jobPostingId: z.coerce.number().int().positive().optional(),
  jobTitle: z.string().trim().optional(),
  targetRole: z.string().trim().optional(),
  applicationDate: dateOnlySchema,
  jobDescription: z.string().trim().optional()
}).transform((body) => {
  const jobTitle = body.jobTitle || body.targetRole;
  if (!body.jobPostingId && (!jobTitle || jobTitle.length < 2)) {
    throw new Error("Job title is required.");
  }

  return {
    jobPostingId: body.jobPostingId,
    jobTitle: jobTitle ?? "",
    applicationDate: body.applicationDate,
    jobDescription: body.jobDescription
  };
});

const privacyRedactionSchema = z.object({
  name: z.string().trim().max(200).optional(),
  names: z.array(z.string().trim().max(200)).max(5).default([]),
  emails: z.array(z.string().trim().max(320)).max(10).default([]),
  phones: z.array(z.string().trim().max(80)).max(10).default([]),
  addressLines: z.array(z.string().trim().max(300)).max(12).default([]),
  links: z.array(z.string().trim().max(300)).max(10).default([])
}).default({});

const passwordSchema = z.string()
  .min(12, "Password must be at least 12 characters.")
  .max(256, "Password is too long.")
  .regex(/[a-z]/, "Password must include a lowercase letter.")
  .regex(/[A-Z]/, "Password must include an uppercase letter.")
  .regex(/[0-9]/, "Password must include a number.");

const registerBodySchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(120, "Name is too long."),
  email: z.string().trim().email("Enter a valid email.").max(320, "Email is too long."),
  password: passwordSchema,
  passwordConfirmation: z.string().min(1, "Retype password.")
}).refine((body) => body.password === body.passwordConfirmation, {
  message: "Passwords must match.",
  path: ["passwordConfirmation"]
});

const loginBodySchema = z.object({
  email: z.string().trim().email("Enter a valid email."),
  password: z.string().min(1, "Password is required.")
});

const updateProfileBodySchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(120, "Name is too long."),
  email: z.string().trim().email("Enter a valid email.").max(320, "Email is too long.")
});

const updatePasswordBodySchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  password: passwordSchema,
  passwordConfirmation: z.string().min(1, "Retype password.")
}).refine((body) => body.password === body.passwordConfirmation, {
  message: "Passwords must match.",
  path: ["passwordConfirmation"]
});

const createJobPostingBodySchema = z.object({
  title: z.string().trim().min(2, "Job title is required.").max(180, "Job title is too long."),
  description: z.string().trim().min(10, "Job description is required.").max(20000, "Job description is too long."),
  skills: z.array(z.string().trim().min(1).max(60)).max(30).default([])
}).transform((body) => ({
  ...body,
  skills: Array.from(new Set(body.skills.map((skill) => skill.trim()).filter(Boolean)))
}));

const adminUsersQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).max(10000).optional(),
  excludeAssessedForPostingId: z.coerce.number().int().positive().optional()
});

const jobPostingsQuerySchema = z.object({
  search: z.string().trim().max(160).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).max(10000).optional()
});

const applicationsQuerySchema = z.object({
  search: z.string().trim().max(160).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).max(10000).optional()
});

const updateInterviewQuestionsBodySchema = z.object({
  interviewQuestions: z.array(z.string().trim().min(1).max(500)).max(20)
}).transform((body) => ({
  interviewQuestions: Array.from(new Set(body.interviewQuestions.map((question) => question.trim()).filter(Boolean)))
}));

const meetingInviteBodySchema = z.object({
  startsAt: z.string().datetime({ offset: true }),
  durationMinutes: z.coerce.number().int().min(15).max(240).default(30),
  message: z.string().trim().min(10, "Message is required.").max(5000, "Message is too long.")
}).transform((body) => ({
  ...body,
  startsAt: new Date(body.startsAt)
}));

const emptyStringToNull = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const appSettingsBodySchema = z.object({
  openaiApiKey: z.string().max(2000).optional(),
  openaiBaseUrl: z.string().max(1000).optional(),
  llmModel: z.string().max(200).optional(),
  llmApiStyle: z.enum(["responses", "chat"]).optional(),
  embeddingApiKey: z.string().max(2000).optional(),
  embeddingBaseUrl: z.string().max(1000).optional(),
  embeddingModel: z.string().max(200).optional(),
  embeddingDimensions: z.coerce.number().int().positive().max(16000).optional().nullable(),
  smtpHost: z.string().max(500).optional(),
  smtpPort: z.coerce.number().int().positive().max(65535).optional().nullable(),
  smtpSecure: z.boolean().optional().nullable(),
  smtpUser: z.string().max(500).optional(),
  smtpPass: z.string().max(2000).optional(),
  emailFrom: z.string().max(500).optional(),
  emailFromName: z.string().max(200).optional()
}).transform((body) => {
  const update: Record<string, unknown> = {};
  const setIfPresent = <K extends keyof typeof body>(key: K, value: unknown) => {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      update[key] = value;
    }
  };

  setIfPresent("openaiBaseUrl", emptyStringToNull(body.openaiBaseUrl));
  setIfPresent("llmModel", emptyStringToNull(body.llmModel));
  setIfPresent("llmApiStyle", body.llmApiStyle ?? null);
  setIfPresent("embeddingBaseUrl", emptyStringToNull(body.embeddingBaseUrl));
  setIfPresent("embeddingModel", emptyStringToNull(body.embeddingModel));
  setIfPresent("embeddingDimensions", body.embeddingDimensions ?? null);
  setIfPresent("smtpHost", emptyStringToNull(body.smtpHost));
  setIfPresent("smtpPort", body.smtpPort ?? null);
  setIfPresent("smtpSecure", body.smtpSecure ?? null);
  setIfPresent("smtpUser", emptyStringToNull(body.smtpUser));
  setIfPresent("emailFrom", emptyStringToNull(body.emailFrom));
  setIfPresent("emailFromName", emptyStringToNull(body.emailFromName));

  if (body.openaiApiKey?.trim()) {
    update.openaiApiKey = body.openaiApiKey.trim();
  }
  if (body.embeddingApiKey?.trim()) {
    update.embeddingApiKey = body.embeddingApiKey.trim();
  }
  if (body.smtpPass?.trim()) {
    update.smtpPass = body.smtpPass.trim();
  }
  return update;
});

type AuthenticatedRequest = express.Request & {
  user: UserRecord;
  token: string;
};

type RedactedResumeUpload = {
  fileName: string;
  contentType: string;
  fileSize: number;
  fileBytes: Buffer;
  text: string;
  privacyRedaction: ReturnType<typeof redactResumePrivacy>["summary"];
};

type AnalysisResumeSource = {
  fileName: string;
  text: string;
  characterCount: number;
  privacyRedaction: PrivacyRedactionSummary;
};

const noPrivacyRedaction = (): PrivacyRedactionSummary => ({
  name: 0,
  email: 0,
  phone: 0,
  address: 0,
  link: 0,
  total: 0
});

const withoutInterviewQuestions = (analysis: ResumeAnalysis): ResumeAnalysis => {
  const { interviewQuestions: _hidden, ...visibleAnalysis } = analysis;
  return visibleAnalysis as ResumeAnalysis;
};

const hideInterviewQuestionsForUsers = (job: JobRecord): JobRecord => {
  if (!job.analysis) {
    return job;
  }

  return {
    ...job,
    analysis: withoutInterviewQuestions(job.analysis)
  };
};

const visibleJob = (job: JobRecord, role: UserRecord["role"]): JobRecord =>
  role === "admin" ? job : hideInterviewQuestionsForUsers(job);

const visibleJobs = (jobs: JobRecord[], role: UserRecord["role"]): JobRecord[] =>
  role === "admin" ? jobs : jobs.map(hideInterviewQuestionsForUsers);

const visibleAnalyzeResponse = (result: AnalyzeResponse, role: UserRecord["role"]): AnalyzeResponse =>
  role === "admin"
    ? result
    : {
        ...result,
        job: visibleJob(result.job, role),
        analysis: withoutInterviewQuestions(result.analysis)
      };

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const bearerToken = (request: express.Request) => {
  const header = request.header("authorization") || "";
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : undefined;
};

const parsePrivacyRedactions = (raw: unknown): PrivacyRedactionInput => {
  if (!raw) {
    return {};
  }

  if (Array.isArray(raw)) {
    return parsePrivacyRedactions(raw[0]);
  }

  if (typeof raw !== "string") {
    return privacyRedactionSchema.parse(raw);
  }

  try {
    return privacyRedactionSchema.parse(JSON.parse(raw));
  } catch (_error) {
    throw new Error("Privacy redaction values are invalid.");
  }
};

const buildPrivacyRedactions = (user: UserRecord, submitted: PrivacyRedactionInput): PrivacyRedactionInput => ({
  names: [user.name, submitted.name, ...(submitted.names ?? [])].filter(
    (name): name is string => Boolean(name?.trim())
  ),
  emails: [user.email, ...(submitted.emails ?? [])],
  phones: submitted.phones ?? [],
  addressLines: submitted.addressLines ?? [],
  links: submitted.links ?? []
});

const safeResumeFileName = (originalName: string) => {
  const extension = path.extname(originalName).toLowerCase();
  const allowedExtensions = new Set([".pdf", ".docx", ".txt", ".md"]);
  return `resume${allowedExtensions.has(extension) ? extension : ""}`;
};

const downloadResumeFileName = (fileName: string, versionNumber: number) => {
  const extension = path.extname(fileName).toLowerCase();
  return `resume-v${versionNumber}${extension}`;
};

const parsePositiveIntegerParam = (value: string | string[] | undefined): number => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = typeof rawValue === "string" ? Number.parseInt(rawValue, 10) : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : Number.NaN;
};

const readRedactedResumeUpload = async ({
  file,
  user,
  privacyRedactions
}: {
  file: Express.Multer.File;
  user: UserRecord;
  privacyRedactions: unknown;
}): Promise<RedactedResumeUpload> => {
  const extractedResumeText = await extractResumeText(file);
  if (extractedResumeText.length < minimumResumeTextLength) {
    throw new Error("The uploaded resume did not contain enough readable text.");
  }

  const { text, summary } = redactResumePrivacy(
    extractedResumeText,
    buildPrivacyRedactions(user, parsePrivacyRedactions(privacyRedactions))
  );

  if (text.length < minimumResumeTextLength) {
    throw new Error("The uploaded resume only contained privacy details after redaction.");
  }

  return {
    fileName: safeResumeFileName(file.originalname),
    contentType: file.mimetype,
    fileSize: file.size,
    fileBytes: file.buffer,
    text,
    privacyRedaction: summary
  };
};

const assertCandidateCanApplyToPosting = async ({
  userId,
  jobPostingId,
  latestResumeCreatedAt
}: {
  userId: number;
  jobPostingId?: number;
  latestResumeCreatedAt?: string;
}) => {
  if (!jobPostingId) {
    return;
  }

  const latestApplication = await getLatestApplicationForUserPosting({ userId, jobPostingId });
  if (!latestApplication) {
    return;
  }

  const resumeTime = latestResumeCreatedAt ? Date.parse(latestResumeCreatedAt) : Number.NaN;
  const applicationTime = Date.parse(latestApplication.createdAt);
  if (!Number.isFinite(resumeTime) || resumeTime <= applicationTime) {
    throw new Error(duplicateApplicationMessage);
  }
};

const runResumeAnalysis = async ({
  user,
  jobPostingId,
  applicationDate,
  jobTitle,
  jobDescription,
  analysisKind = "application",
  resume
}: {
  user: UserRecord;
  jobPostingId?: number;
  applicationDate: string;
  jobTitle: string;
  jobDescription?: string;
  analysisKind?: JobAnalysisKind;
  resume: AnalysisResumeSource;
}): Promise<AnalyzeResponse> => {
  const selectedPosting = jobPostingId ? await getActiveJobPosting(jobPostingId) : undefined;
  if (jobPostingId && !selectedPosting) {
    throw new Error("Choose an active job posting.");
  }

  const resolvedJobTitle = selectedPosting?.title ?? jobTitle;
  const resolvedJobDescription = selectedPosting?.description ?? jobDescription;

  const jobId = await createJob({
    userId: user.id,
    jobPostingId: selectedPosting?.id,
    applicationDate,
    jobTitle: resolvedJobTitle,
    jobDescription: resolvedJobDescription,
    resumeFileName: resume.fileName,
    characterCount: resume.characterCount,
    analysisKind
  });

  const internalReadRole = analysisKind === "candidate_assessment" ? "admin" : user.role;
  let job = await getJob({ id: jobId, userId: user.id, role: internalReadRole });
  if (!job) {
    throw new Error("Created analysis job could not be loaded.");
  }

  try {
    const settings = await getEffectiveAppSettings();
    const { analysis, chunkCount } = await analyzeResume(
      jobId,
      applicationDate,
      resume.text,
      resolvedJobTitle,
      resolvedJobDescription,
      settings
    );

    await completeJob({
      id: jobId,
      analysis,
      chunkCount,
      llmModel: settings.llmModel,
      embeddingModel: settings.embeddingModel
    });
    job = await getJob({ id: jobId, userId: user.id, role: internalReadRole });
    if (!job) {
      throw new Error("Completed analysis job could not be loaded.");
    }
    refreshUserMatchProfileAfterWrite(user.id);

    return {
      job,
      analysis,
      resumeStats: {
        fileName: resume.fileName,
        characterCount: resume.characterCount,
        chunkCount
      },
      privacyRedaction: resume.privacyRedaction,
      models: {
        llm: settings.llmModel,
        embedding: settings.embeddingModel
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    await failJob(jobId, message);
    throw error;
  }
};

const requireAuth: express.RequestHandler = async (request, response, next) => {
  try {
    const token = bearerToken(request);
    if (!token) {
      response.status(401).json({ error: "Sign in to continue." });
      return;
    }

    const user = await findUserBySessionToken(token);
    if (!user) {
      response.status(401).json({ error: "Session expired. Sign in again." });
      return;
    }

    (request as AuthenticatedRequest).user = user;
    (request as AuthenticatedRequest).token = token;
    next();
  } catch (error) {
    next(error);
  }
};

const requireAdmin: express.RequestHandler = (request, response, next) => {
  const { user } = request as AuthenticatedRequest;
  if (user.role !== "admin") {
    response.status(403).json({ error: "Admin access required." });
    return;
  }

  next();
};

const refreshUserMatchProfileAfterWrite = (userId: number) => {
  void refreshUserMatchProfile(userId).catch((error) => {
    console.warn(
      `User match profile refresh failed for user ${userId}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  });
};

const refreshJobPostingMatchProfileAfterWrite = (jobPostingId: number) => {
  void refreshJobPostingMatchProfile(jobPostingId).catch((error) => {
    console.warn(
      `Job posting match profile refresh failed for posting ${jobPostingId}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  });
};

app.get("/api/health", async (_request, response) => {
  const settings = await getEffectiveAppSettings();
  let postgres: { ok: boolean; extension: string; error?: string };
  try {
    await checkPostgres();
    postgres = { ok: true, extension: "pgvector" };
  } catch (error) {
    postgres = {
      ok: false,
      extension: "pgvector",
      error: error instanceof Error ? error.message : "Postgres is unavailable."
    };
  }

  response.json({
    ok: true,
    models: {
      llm: settings.llmModel,
      embedding: settings.embeddingModel
    },
    storage: {
      postgres
    }
  });
});

app.get("/api/instance-health", (_request, response) => {
  response.json(localInstanceHealth());
});

app.get("/api/jobs", requireAuth, async (request, response) => {
  const { user } = request as AuthenticatedRequest;
  const query = applicationsQuerySchema.parse(request.query);
  response.json({
    jobs: visibleJobs(
      await listJobs({
        userId: user.id,
        role: user.role,
        limit: query.limit ?? 10,
        offset: query.offset ?? 0
      }),
      user.role
    )
  });
});

app.get("/api/applications", requireAuth, async (request, response) => {
  const { user } = request as AuthenticatedRequest;
  const query = applicationsQuerySchema.parse(request.query);
  const search = query.search ?? "";
  const limit = query.limit ?? 10;
  const offset = query.offset ?? 0;
  let semanticJobIds: number[] = [];

  try {
    semanticJobIds = (await matchApplicationsBySemanticQuery({
      search,
      userId: user.id,
      role: user.role,
      limit: Math.min(offset + limit, 200)
    })).map((match) => match.jobId);
  } catch (error) {
    console.warn(
      `Semantic application search failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }

  response.json({
    jobs: visibleJobs(
      await searchJobs({
        userId: user.id,
        role: user.role,
        search,
        semanticJobIds,
        limit,
        offset
      }),
      user.role
    )
  });
});

app.get("/api/job-postings", requireAuth, async (request, response) => {
  const { user } = request as AuthenticatedRequest;
  const query = jobPostingsQuerySchema.parse(request.query);
  const search = query.search ?? "";
  const limit = query.limit ?? 10;
  const offset = query.offset ?? 0;
  let semanticJobPostingIds: number[] = [];

  try {
    semanticJobPostingIds = (await matchJobPostingsBySemanticQuery(search, Math.min(offset + limit, 200))).map(
      (match) => match.jobPostingId
    );
  } catch (error) {
    console.warn(
      `Semantic job posting search failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }

  response.json({
    jobPostings: await listJobPostings({
      includeArchived: user.role === "admin",
      search,
      semanticJobPostingIds,
      limit,
      offset
    })
  });
});

app.post("/api/register", async (request, response) => {
  try {
    const body = registerBodySchema.parse(request.body);
    const passwordHash = await hashPassword(body.password);
    const user = await createUser({
      name: body.name,
      email: body.email,
      passwordHash
    });
    const token = await createSession(user.id);

    response.status(201).json({ user, token });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed.";
    const status = message.includes("already exists") ? 409 : 400;
    response.status(status).json({ error: message });
  }
});

app.post("/api/login", async (request, response) => {
  try {
    const body = loginBodySchema.parse(request.body);
    const account = await findUserByEmail(body.email);

    if (!account || !(await verifyPassword(body.password, account.passwordHash))) {
      response.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const token = await createSession(account.user.id);
    response.json({ user: account.user, token });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed.";
    response.status(400).json({ error: message });
  }
});

app.get("/api/me", requireAuth, async (request, response) => {
  const { user } = request as AuthenticatedRequest;
  response.json({ user });
});

app.get("/api/profile", requireAuth, async (request, response) => {
  const { user } = request as AuthenticatedRequest;
  response.json({
    user,
    resumes: await listResumeVersions(user.id)
  });
});

app.patch("/api/profile", requireAuth, async (request, response) => {
  try {
    const { user } = request as AuthenticatedRequest;
    const body = updateProfileBodySchema.parse(request.body);
    const updatedUser = await updateUserProfile({
      id: user.id,
      name: body.name,
      email: body.email
    });

    refreshUserMatchProfileAfterWrite(user.id);
    response.json({ user: updatedUser });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Profile update failed.";
    const status = message.includes("already exists") ? 409 : 400;
    response.status(status).json({ error: message });
  }
});

app.patch("/api/profile/password", requireAuth, async (request, response) => {
  try {
    const { user } = request as AuthenticatedRequest;
    const body = updatePasswordBodySchema.parse(request.body);
    const account = await findUserByEmail(user.email);

    if (!account || !(await verifyPassword(body.currentPassword, account.passwordHash))) {
      response.status(400).json({ error: "Current password is incorrect." });
      return;
    }

    if (await verifyPassword(body.password, account.passwordHash)) {
      response.status(400).json({ error: "Choose a new password that is different from your current password." });
      return;
    }

    await updateUserPassword({
      id: user.id,
      passwordHash: await hashPassword(body.password)
    });

    response.json({ updated: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Password update failed.";
    response.status(400).json({ error: message });
  }
});

app.get("/api/resumes", requireAuth, async (request, response) => {
  const { user } = request as AuthenticatedRequest;
  response.json({ resumes: await listResumeVersions(user.id) });
});

app.post("/api/resumes/privacy-preview", requireAuth, upload.single("resume"), async (request, response) => {
  try {
    const { user } = request as AuthenticatedRequest;
    if (!request.file) {
      response.status(400).json({ error: "Upload a resume file." });
      return;
    }

    const extractedResumeText = await extractResumeText(request.file);
    response.json({
      privacyRedactions: detectResumePrivacy(extractedResumeText, {
        name: user.name,
        email: user.email
      }),
      characterCount: extractedResumeText.length
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Privacy preview failed.";
    response.status(400).json({ error: message });
  }
});

app.post("/api/resumes", requireAuth, upload.single("resume"), async (request, response) => {
  try {
    const { user } = request as AuthenticatedRequest;
    if (!request.file) {
      response.status(400).json({ error: "Upload a resume file." });
      return;
    }

    const resumeUpload = await readRedactedResumeUpload({
      file: request.file,
      user,
      privacyRedactions: request.body.privacyRedactions
    });

    const resume = await createResumeVersion({
      userId: user.id,
      fileName: resumeUpload.fileName,
      contentType: resumeUpload.contentType,
      fileSize: resumeUpload.fileSize,
      fileBytes: resumeUpload.fileBytes,
      characterCount: resumeUpload.text.length,
      resumeText: resumeUpload.text
    });

    refreshUserMatchProfileAfterWrite(user.id);
    response.status(201).json({ resume, privacyRedaction: resumeUpload.privacyRedaction });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resume upload failed.";
    response.status(400).json({ error: message });
  }
});

app.get("/api/resumes/:resumeId/download", requireAuth, async (request, response) => {
  const { user } = request as AuthenticatedRequest;
  const resumeId = parsePositiveIntegerParam(request.params.resumeId);
  if (!Number.isSafeInteger(resumeId) || resumeId <= 0) {
    response.status(400).json({ error: "Choose a valid resume version." });
    return;
  }

  const resume = await getResumeVersionDownload({
    resumeId,
    userId: user.id,
    role: user.role
  });
  if (!resume) {
    response.status(404).json({ error: "Resume version not found." });
    return;
  }

  response.setHeader("Content-Type", resume.contentType);
  response.setHeader("Content-Length", String(resume.fileBytes.length));
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="${downloadResumeFileName(resume.fileName, resume.versionNumber)}"`
  );
  response.send(resume.fileBytes);
});

app.get("/api/admin/jobs/:jobId/assessment.pdf", requireAuth, requireAdmin, async (request, response) => {
  try {
    const { user } = request as AuthenticatedRequest;
    const jobId = parsePositiveIntegerParam(request.params.jobId);
    if (!Number.isSafeInteger(jobId) || jobId <= 0) {
      response.status(400).json({ error: "Choose a valid application." });
      return;
    }

    const job = await getJob({ id: jobId, userId: user.id, role: user.role });
    if (!job) {
      response.status(404).json({ error: "Application not found." });
      return;
    }

    if (!job.analysis) {
      response.status(400).json({ error: "No completed LLM assessment is available for this application." });
      return;
    }

    const pdf = buildAssessmentPdf(job);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Length", String(pdf.length));
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${assessmentPdfFileName(job)}"`
    );
    response.send(pdf);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Assessment download failed.";
    response.status(400).json({ error: message });
  }
});

app.post("/api/admin/jobs/:jobId/meeting-invite", requireAuth, requireAdmin, async (request, response) => {
  const { user } = request as AuthenticatedRequest;
  const jobId = parsePositiveIntegerParam(request.params.jobId);
  if (!Number.isSafeInteger(jobId) || jobId <= 0) {
    response.status(400).json({ error: "Choose a valid application." });
    return;
  }

  try {
    const body = meetingInviteBodySchema.parse(request.body);
    const job = await getJob({ id: jobId, userId: user.id, role: user.role });
    if (!job) {
      response.status(404).json({ error: "Application not found." });
      return;
    }

    if (!job.userEmail) {
      response.status(400).json({ error: "This application does not have a candidate email address." });
      return;
    }

    await sendMeetingInvite({
      job,
      admin: user,
      startsAt: body.startsAt,
      durationMinutes: body.durationMinutes,
      message: body.message
    });

    response.status(202).json({ sent: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meeting invite failed.";
    const status = message.includes("Email service is not configured") ? 503 : 400;
    response.status(status).json({ error: message });
  }
});

app.post("/api/logout", requireAuth, async (request, response) => {
  const { token } = request as AuthenticatedRequest;
  await deleteSession(token);
  response.status(204).end();
});

app.get("/api/admin/overview", requireAuth, requireAdmin, async (_request, response) => {
  const [users, jobs, jobPostings, stats] = await Promise.all([
    listUsers(),
    listJobs({ userId: 0, role: "admin", limit: 100 }),
    listJobPostings({ includeArchived: true }),
    getAdminStats()
  ]);

  response.json({ users, jobs, jobPostings, stats });
});

app.get("/api/admin/users", requireAuth, requireAdmin, async (request, response) => {
  const query = adminUsersQuerySchema.parse(request.query);
  const search = query.search ?? "";
  const limit = query.limit ?? 10;
  const offset = query.offset ?? 0;
  let semanticUserIds: number[] = [];

  try {
    semanticUserIds = (await matchAdminUsersBySemanticQuery(search, Math.min(offset + limit, 200))).map(
      (match) => match.userId
    );
  } catch (error) {
    console.warn(
      `Admin semantic user search failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }

  response.json({
    users: await listAdminUserDetails({
      search,
      semanticUserIds,
      limit,
      offset,
      excludeAssessedForPostingId: query.excludeAssessedForPostingId
    })
  });
});

app.get("/api/admin/system-health", requireAuth, requireAdmin, async (_request, response) => {
  response.json(await buildSystemHealth());
});

app.get("/api/admin/settings", requireAuth, requireAdmin, async (_request, response) => {
  response.json({ settings: await getPublicAppSettings() });
});

app.patch("/api/admin/settings", requireAuth, requireAdmin, async (request, response) => {
  try {
    const body = appSettingsBodySchema.parse(request.body);
    response.json({ settings: await updateAppSettings(body) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Settings update failed.";
    response.status(400).json({ error: message });
  }
});

app.post("/api/admin/job-postings", requireAuth, requireAdmin, async (request, response) => {
  try {
    const { user } = request as AuthenticatedRequest;
    const body = createJobPostingBodySchema.parse(request.body);
    const jobPosting = await createJobPosting({
      createdByUserId: user.id,
      title: body.title,
      description: body.description,
      skills: body.skills
    });

    refreshJobPostingMatchProfileAfterWrite(jobPosting.id);
    response.status(201).json({ jobPosting });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Job posting creation failed.";
    response.status(400).json({ error: message });
  }
});

app.get("/api/admin/job-postings/:jobPostingId/applications", requireAuth, requireAdmin, async (request, response) => {
  const query = applicationsQuerySchema.parse(request.query);
  const jobPostingId = parsePositiveIntegerParam(request.params.jobPostingId);
  if (!Number.isSafeInteger(jobPostingId) || jobPostingId <= 0) {
    response.status(400).json({ error: "Choose a valid job posting." });
    return;
  }

  response.json({
    jobs: await listJobsForPosting({
      jobPostingId,
      limit: query.limit ?? 10,
      offset: query.offset ?? 0
    })
  });
});

app.post("/api/admin/users/:userId/analyze/latest", requireAuth, requireAdmin, async (request, response) => {
  const candidateUserId = parsePositiveIntegerParam(request.params.userId);
  if (!Number.isSafeInteger(candidateUserId) || candidateUserId <= 0) {
    response.status(400).json({ error: "Choose a valid candidate." });
    return;
  }

  try {
    const admin = (request as AuthenticatedRequest).user;
    const body = analyzeStoredResumeBodySchema.parse(request.body);
    const candidate = await findUserById(candidateUserId);
    if (!candidate) {
      response.status(404).json({ error: "Candidate not found." });
      return;
    }

    if (body.jobPostingId && await hasJobForUserPosting({ userId: candidate.id, jobPostingId: body.jobPostingId })) {
      response.status(409).json({ error: "This candidate has already been assessed for the selected posting." });
      return;
    }

    const latestResume = await getLatestResumeVersion(candidate.id);
    if (!latestResume) {
      response.status(400).json({ error: "Choose a candidate with an uploaded resume." });
      return;
    }

    if (latestResume.resumeText.length < minimumResumeTextLength) {
      response.status(400).json({ error: "The candidate's latest stored resume does not contain enough readable text." });
      return;
    }

    response.json(
      visibleAnalyzeResponse(await runResumeAnalysis({
        user: candidate,
        jobPostingId: body.jobPostingId,
        applicationDate: body.applicationDate,
        jobTitle: body.jobTitle,
        jobDescription: body.jobDescription,
        analysisKind: "candidate_assessment",
        resume: {
          fileName: latestResume.fileName,
          characterCount: latestResume.characterCount,
          text: latestResume.resumeText,
          privacyRedaction: noPrivacyRedaction()
        }
      }), admin.role)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    const status = message === duplicateApplicationMessage
      ? 409
      : message.includes("OPENAI_API_KEY") || message.includes("API key")
        ? 500
        : 400;
    response.status(status).json({ error: message });
  }
});

app.patch("/api/admin/jobs/:jobId/convert-to-application", requireAuth, requireAdmin, async (request, response) => {
  const { user } = request as AuthenticatedRequest;
  const jobId = parsePositiveIntegerParam(request.params.jobId);
  if (!Number.isSafeInteger(jobId) || jobId <= 0) {
    response.status(400).json({ error: "Choose a valid candidate assessment." });
    return;
  }

  try {
    const job = await getJob({ id: jobId, userId: user.id, role: user.role });
    if (!job) {
      response.status(404).json({ error: "Candidate assessment not found." });
      return;
    }

    if (job.analysisKind !== "candidate_assessment") {
      response.status(400).json({ error: "Only candidate assessments can be converted to applications." });
      return;
    }

    await convertJobToApplication(jobId);
    const updatedJob = await getJob({ id: jobId, userId: user.id, role: user.role });
    response.json({ job: updatedJob });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Application conversion failed.";
    response.status(400).json({ error: message });
  }
});

app.patch("/api/admin/jobs/:jobId/interview-questions", requireAuth, requireAdmin, async (request, response) => {
  const { user } = request as AuthenticatedRequest;
  const jobId = parsePositiveIntegerParam(request.params.jobId);
  if (!Number.isSafeInteger(jobId) || jobId <= 0) {
    response.status(400).json({ error: "Choose a valid application." });
    return;
  }

  try {
    const body = updateInterviewQuestionsBodySchema.parse(request.body);
    const job = await getJob({ id: jobId, userId: user.id, role: user.role });
    if (!job) {
      response.status(404).json({ error: "Application not found." });
      return;
    }

    if (!job.analysis) {
      response.status(400).json({ error: "No completed LLM assessment is available for this application." });
      return;
    }

    await updateJobInterviewQuestions({
      id: jobId,
      interviewQuestions: body.interviewQuestions
    });

    const updatedJob = await getJob({ id: jobId, userId: user.id, role: user.role });
    response.json({ job: updatedJob });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Interview question update failed.";
    response.status(400).json({ error: message });
  }
});

app.post("/api/analyze", requireAuth, upload.single("resume"), async (request, response) => {
  const { user } = request as AuthenticatedRequest;
  try {
    if (!request.file) {
      response.status(400).json({ error: "Upload a resume file." });
      return;
    }

    const body = analyzeBodySchema.parse(request.body);
    if (body.jobPostingId && user.role !== "admin") {
      const latestResume = await getLatestResumeVersion(user.id);
      await assertCandidateCanApplyToPosting({
        userId: user.id,
        jobPostingId: body.jobPostingId,
        latestResumeCreatedAt: latestResume?.createdAt
      });
    }

    const resumeUpload = await readRedactedResumeUpload({
      file: request.file,
      user,
      privacyRedactions: body.privacyRedactions
    });

    response.json(
      visibleAnalyzeResponse(await runResumeAnalysis({
        user,
        jobPostingId: body.jobPostingId,
        applicationDate: body.applicationDate,
        jobTitle: body.jobTitle,
        jobDescription: body.jobDescription,
        resume: {
          fileName: resumeUpload.fileName,
          characterCount: resumeUpload.text.length,
          text: resumeUpload.text,
          privacyRedaction: resumeUpload.privacyRedaction
        }
      }), user.role)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    const status = message === duplicateApplicationMessage
      ? 409
      : message.includes("OPENAI_API_KEY") || message.includes("API key")
        ? 500
        : 400;
    response.status(status).json({ error: message });
  }
});

app.post("/api/analyze/latest", requireAuth, async (request, response) => {
  const { user } = request as AuthenticatedRequest;
  try {
    const body = analyzeStoredResumeBodySchema.parse(request.body);
    const latestResume = await getLatestResumeVersion(user.id);
    if (!latestResume) {
      response.status(400).json({ error: "Upload a resume to your profile before matching a role." });
      return;
    }

    if (user.role !== "admin") {
      await assertCandidateCanApplyToPosting({
        userId: user.id,
        jobPostingId: body.jobPostingId,
        latestResumeCreatedAt: latestResume.createdAt
      });
    }

    if (latestResume.resumeText.length < minimumResumeTextLength) {
      response.status(400).json({ error: "The latest stored resume does not contain enough readable text." });
      return;
    }

    response.json(
      visibleAnalyzeResponse(await runResumeAnalysis({
        user,
        jobPostingId: body.jobPostingId,
        applicationDate: body.applicationDate,
        jobTitle: body.jobTitle,
        jobDescription: body.jobDescription,
        resume: {
          fileName: latestResume.fileName,
          characterCount: latestResume.characterCount,
          text: latestResume.resumeText,
          privacyRedaction: noPrivacyRedaction()
        }
      }), user.role)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    const status = message === duplicateApplicationMessage
      ? 409
      : message.includes("OPENAI_API_KEY") || message.includes("API key")
        ? 500
        : 400;
    response.status(status).json({ error: message });
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, "../client");

app.use(express.static(clientDist));
app.get(/.*/, (_request, response) => {
  response.sendFile(path.join(clientDist, "index.html"));
});

const start = async () => {
  if (config.adminPassword) {
    await upsertAdminUser({
      name: config.adminName,
      email: config.adminEmail,
      passwordHash: await hashPassword(config.adminPassword)
    });
  }

  app.listen(config.port, config.host, () => {
    console.log(`Roos API listening on http://${config.host}:${config.port}`);
  });
};

void start();
