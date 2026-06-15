export type EvidenceChunk = {
  id: number;
  text: string;
  score: number;
};

export type RequirementAssessment = {
  category: "minimum" | "role_competency" | "domain" | "preferred" | "seniority";
  requirement: string;
  importance: "must_have" | "preferred";
  status: "met" | "partially_met" | "not_evidenced";
  evidence: string[];
  rationale: string;
};

export type ScoreBreakdown = {
  minimumQualifications: number;
  roleCompetencies: number;
  domainExperience: number;
  preferredQualifications: number;
  seniorityScope: number;
  evidenceQuality: number;
};

export type FairnessReview = {
  ignoredFactors: string[];
  notes: string[];
};

export type AnalysisRequestMeta = {
  applicationDate: string;
  jobTitle: string;
  jobDescription?: string;
  jobPostingId?: number;
};

export type ResumeAnalysis = {
  candidateSummary: string;
  fitScore: number;
  fitLevel: "low" | "medium" | "high";
  strengths: string[];
  gaps: string[];
  risks: string[];
  recommendations: string[];
  suggestedKeywords: string[];
  interviewQuestions: string[];
  requirementAssessments: RequirementAssessment[];
  scoreBreakdown: ScoreBreakdown;
  fairnessReview: FairnessReview;
  evidence: EvidenceChunk[];
};

export type AnalyzeResponse = {
  job: JobRecord;
  analysis: ResumeAnalysis;
  resumeStats: {
    fileName: string;
    characterCount: number;
    chunkCount: number;
  };
  models: {
    llm: string;
    embedding: string;
  };
};

export type JobRecord = {
  id: number;
  userId?: number;
  jobPostingId?: number;
  jobPostingTitle?: string;
  userName?: string;
  userEmail?: string;
  status: "running" | "completed" | "failed";
  applicationDate: string;
  jobTitle: string;
  jobDescription?: string;
  resumeFileName?: string;
  characterCount?: number;
  chunkCount?: number;
  llmRecommendation?: string;
  analysis?: ResumeAnalysis;
  fitScore?: number;
  fitLevel?: "low" | "medium" | "high";
  errorMessage?: string;
  llmModel?: string;
  embeddingModel?: string;
  createdAt: string;
  updatedAt: string;
};

export type JobsResponse = {
  jobs: JobRecord[];
};

export type UserRecord = {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
  createdAt: string;
};

export type RegisterResponse = {
  user: UserRecord;
  token: string;
};

export type LoginResponse = RegisterResponse;

export type MeResponse = {
  user: UserRecord;
};

export type AdminUserRecord = UserRecord & {
  applicationCount: number;
};

export type AdminStats = {
  userCount: number;
  jobCount: number;
  jobPostingCount: number;
  completedJobCount: number;
  failedJobCount: number;
};

export type AdminOverviewResponse = {
  users: AdminUserRecord[];
  jobs: JobRecord[];
  jobPostings: JobPostingRecord[];
  stats: AdminStats;
};

export type JobPostingRecord = {
  id: number;
  createdByUserId?: number;
  title: string;
  description: string;
  skills: string[];
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
  matchCount?: number;
  averageFitScore?: number;
  topFitScore?: number;
};

export type JobPostingsResponse = {
  jobPostings: JobPostingRecord[];
};

export type CreateJobPostingResponse = {
  jobPosting: JobPostingRecord;
};

export type ResumeVersionRecord = {
  id: number;
  userId: number;
  versionNumber: number;
  fileName: string;
  contentType?: string;
  characterCount: number;
  createdAt: string;
};

export type ResumeVersionsResponse = {
  resumes: ResumeVersionRecord[];
};

export type ProfileResponse = {
  user: UserRecord;
  resumes: ResumeVersionRecord[];
};

export type UpdateProfileResponse = {
  user: UserRecord;
};

export type UploadResumeResponse = {
  resume: ResumeVersionRecord;
};

export type ComponentHealth = {
  name: string;
  status: "online" | "degraded" | "offline";
  details: string;
  checkedAt: string;
};

export type AppInstanceHealth = {
  name: string;
  url: string;
  status: "online" | "offline";
  checkedAt: string;
  uptimeSeconds?: number;
  hostname?: string;
  pid?: number;
  error?: string;
};

export type SystemHealthResponse = {
  ok: boolean;
  generatedAt: string;
  components: ComponentHealth[];
  instances: AppInstanceHealth[];
  models: {
    llm: string;
    embedding: string;
    llmApiStyle: "responses" | "chat";
  };
};
