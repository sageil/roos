export type EvidenceChunk = {
  id: number;
  text: string;
  score: number;
};

export type AnalysisRequestMeta = {
  applicationDate: string;
  jobTitle: string;
  jobDescription?: string;
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
  completedJobCount: number;
  failedJobCount: number;
};

export type AdminOverviewResponse = {
  users: AdminUserRecord[];
  jobs: JobRecord[];
  stats: AdminStats;
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
