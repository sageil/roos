import cors from "cors";
import express from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { UserRecord } from "../shared/types.js";
import { analyzeResume } from "./analysis.js";
import { config } from "./config.js";
import { matchJobPostingsBySemanticQuery, refreshJobPostingMatchProfile } from "./jobPostingMatchProfiles.js";
import { createJobPosting, getActiveJobPosting, listJobPostings } from "./jobPostingStore.js";
import { hashPassword, verifyPassword } from "./passwords.js";
import { checkPostgres, completeJob, createJob, failJob, getJob, listJobs } from "./postgresStore.js";
import { redactResumePrivacy, type PrivacyRedactionInput } from "./privacyRedaction.js";
import { createResumeVersion, listResumeVersions } from "./resumeVersionStore.js";
import { createSession, deleteSession, findUserBySessionToken } from "./sessions.js";
import { buildSystemHealth, localInstanceHealth } from "./systemHealth.js";
import { extractResumeText } from "./textExtraction.js";
import { matchAdminUsersBySemanticQuery, refreshUserMatchProfile } from "./userMatchProfiles.js";
import {
  createUser,
  findUserByEmail,
  getAdminStats,
  listAdminUserDetails,
  listUsers,
  updateUserProfile,
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

const analyzeBodySchema = z.object({
  jobPostingId: z.coerce.number().int().positive().optional(),
  jobTitle: z.string().trim().optional(),
  targetRole: z.string().trim().optional(),
  applicationDate: z.string().trim().min(4, "Application date is required."),
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

const privacyRedactionSchema = z.object({
  name: z.string().trim().max(200).optional(),
  names: z.array(z.string().trim().max(200)).max(5).default([]),
  emails: z.array(z.string().trim().max(320)).max(10).default([]),
  phones: z.array(z.string().trim().max(80)).max(10).default([]),
  addressLines: z.array(z.string().trim().max(300)).max(12).default([]),
  links: z.array(z.string().trim().max(300)).max(10).default([])
}).default({});

const registerBodySchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(120, "Name is too long."),
  email: z.string().trim().email("Enter a valid email.").max(320, "Email is too long."),
  password: z.string()
    .min(12, "Password must be at least 12 characters.")
    .max(256, "Password is too long.")
    .regex(/[a-z]/, "Password must include a lowercase letter.")
    .regex(/[A-Z]/, "Password must include an uppercase letter.")
    .regex(/[0-9]/, "Password must include a number.")
});

const loginBodySchema = z.object({
  email: z.string().trim().email("Enter a valid email."),
  password: z.string().min(1, "Password is required.")
});

const updateProfileBodySchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(120, "Name is too long."),
  email: z.string().trim().email("Enter a valid email.").max(320, "Email is too long.")
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
  limit: z.coerce.number().int().min(1).max(200).optional()
});

const jobPostingsQuerySchema = z.object({
  search: z.string().trim().max(160).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
});

type AuthenticatedRequest = express.Request & {
  user: UserRecord;
  token: string;
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
      llm: config.llmModel,
      embedding: config.embeddingModel
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
  response.json({ jobs: await listJobs({ userId: user.id, role: user.role }) });
});

app.get("/api/job-postings", requireAuth, async (request, response) => {
  const { user } = request as AuthenticatedRequest;
  const query = jobPostingsQuerySchema.parse(request.query);
  const search = query.search ?? "";
  let semanticJobPostingIds: number[] = [];

  try {
    semanticJobPostingIds = (await matchJobPostingsBySemanticQuery(search, query.limit ?? 100)).map(
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
      limit: query.limit ?? 100
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

app.get("/api/resumes", requireAuth, async (request, response) => {
  const { user } = request as AuthenticatedRequest;
  response.json({ resumes: await listResumeVersions(user.id) });
});

app.post("/api/resumes", requireAuth, upload.single("resume"), async (request, response) => {
  try {
    const { user } = request as AuthenticatedRequest;
    if (!request.file) {
      response.status(400).json({ error: "Upload a resume file." });
      return;
    }

    const extractedResumeText = await extractResumeText(request.file);
    if (extractedResumeText.length < 80) {
      response.status(400).json({ error: "The uploaded resume did not contain enough readable text." });
      return;
    }

    const { text: resumeText, summary: privacyRedaction } = redactResumePrivacy(
      extractedResumeText,
      buildPrivacyRedactions(user, parsePrivacyRedactions(request.body.privacyRedactions))
    );

    if (resumeText.length < 80) {
      response.status(400).json({ error: "The uploaded resume only contained privacy details after redaction." });
      return;
    }

    const resume = await createResumeVersion({
      userId: user.id,
      fileName: safeResumeFileName(request.file.originalname),
      contentType: request.file.mimetype,
      characterCount: resumeText.length,
      resumeText
    });

    refreshUserMatchProfileAfterWrite(user.id);
    response.status(201).json({ resume, privacyRedaction });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resume upload failed.";
    response.status(400).json({ error: message });
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
  let semanticUserIds: number[] = [];

  try {
    semanticUserIds = (await matchAdminUsersBySemanticQuery(search, query.limit ?? 100)).map(
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
      limit: query.limit ?? 100
    })
  });
});

app.get("/api/admin/system-health", requireAuth, requireAdmin, async (_request, response) => {
  response.json(await buildSystemHealth());
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

app.post("/api/analyze", requireAuth, upload.single("resume"), async (request, response) => {
  const { user } = request as AuthenticatedRequest;
  try {
    if (!request.file) {
      response.status(400).json({ error: "Upload a resume file." });
      return;
    }

    const body = analyzeBodySchema.parse(request.body);
    const selectedPosting = body.jobPostingId
      ? await getActiveJobPosting(body.jobPostingId)
      : undefined;
    if (body.jobPostingId && !selectedPosting) {
      response.status(400).json({ error: "Choose an active job posting." });
      return;
    }

    const jobTitle = selectedPosting?.title ?? body.jobTitle;
    const jobDescription = selectedPosting?.description ?? body.jobDescription;
    const extractedResumeText = await extractResumeText(request.file);

    if (extractedResumeText.length < 80) {
      response.status(400).json({ error: "The uploaded resume did not contain enough readable text." });
      return;
    }

    const { text: resumeText, summary: privacyRedaction } = redactResumePrivacy(
      extractedResumeText,
      buildPrivacyRedactions(user, parsePrivacyRedactions(body.privacyRedactions))
    );

    if (resumeText.length < 80) {
      response.status(400).json({ error: "The uploaded resume only contained privacy details after redaction." });
      return;
    }

    const jobId = await createJob({
      userId: user.id,
      jobPostingId: selectedPosting?.id,
      applicationDate: body.applicationDate,
      jobTitle,
      jobDescription,
      resumeFileName: safeResumeFileName(request.file.originalname),
      characterCount: resumeText.length
    });

    let job = await getJob({ id: jobId, userId: user.id, role: user.role });

    try {
      const { analysis, chunkCount } = await analyzeResume(
        jobId,
        body.applicationDate,
        resumeText,
        jobTitle,
        jobDescription
      );

      await completeJob({ id: jobId, analysis, chunkCount });
      job = await getJob({ id: jobId, userId: user.id, role: user.role });
      refreshUserMatchProfileAfterWrite(user.id);

      response.json({
        job,
        analysis,
        resumeStats: {
          fileName: safeResumeFileName(request.file.originalname),
          characterCount: resumeText.length,
          chunkCount
        },
        privacyRedaction,
        models: {
          llm: config.llmModel,
          embedding: config.embeddingModel
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      await failJob(jobId, message);
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    const status = message.includes("OPENAI_API_KEY") || message.includes("API key") ? 500 : 400;
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
    console.log(`Resume analyzer API listening on http://${config.host}:${config.port}`);
  });
};

void start();
