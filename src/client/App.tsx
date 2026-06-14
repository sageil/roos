import {
  Activity,
  AlertCircle,
  Archive,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock3,
  ClipboardList,
  Database,
  FileText,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  Layers3,
  Loader2,
  SearchCheck,
  Server,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  UserPlus,
  UserRound,
  UsersRound,
  XCircle
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  AdminOverviewResponse,
  AnalyzeResponse,
  CreateJobPostingResponse,
  JobRecord,
  JobPostingRecord,
  JobPostingsResponse,
  JobsResponse,
  LoginResponse,
  ProfileResponse,
  RegisterResponse,
  ResumeAnalysis,
  ResumeVersionRecord,
  UpdateProfileResponse,
  UploadResumeResponse,
  UserRecord
} from "../shared/types";

type Status = "idle" | "loading" | "success" | "error";

type HealthResponse = {
  models: {
    llm: string;
    embedding: string;
  };
  storage?: {
    postgres: {
      ok: boolean;
      extension: string;
      error?: string;
    };
  };
};

const authStorageKey = "resume-analyzer-token";

const today = () => {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const fitLabel = (score: number) => {
  if (score >= 80) {
    return "Strong fit";
  }
  if (score >= 60) {
    return "Partial fit";
  }
  return "Needs work";
};

const fitTone = (score: number): "success" | "warning" | "danger" => {
  if (score >= 80) {
    return "success";
  }
  if (score >= 60) {
    return "warning";
  }
  return "danger";
};

const evidenceRelevanceLabel = (score: number) => {
  if (score >= 0.65) {
    return "Evidence relevance: high";
  }
  if (score >= 0.35) {
    return "Evidence relevance: medium";
  }
  return "Evidence relevance: low";
};

const JobFitBadge = ({ job }: { job: JobRecord }) =>
  typeof job.fitScore === "number" ? (
    <StatusBadge tone={fitTone(job.fitScore)}>
      {fitLabel(job.fitScore)} | {job.fitScore}/100
    </StatusBadge>
  ) : (
    <StatusBadge tone="neutral">No fit score</StatusBadge>
  );

const StatusBadge = ({
  tone = "neutral",
  children
}: {
  tone?: "neutral" | "success" | "warning" | "danger";
  children: React.ReactNode;
}) => <span className={`status-badge ${tone}`}>{children}</span>;

const ListBlock = ({
  title,
  items,
  icon
}: {
  title: string;
  items: string[];
  icon: React.ReactNode;
}) => (
  <section className="surface-card">
    <div className="panel-heading">
      {icon}
      <h2>{title}</h2>
    </div>
    {items.length > 0 ? (
      <ul className="item-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    ) : (
      <p className="muted">No items returned.</p>
    )}
  </section>
);

const MetricTile = ({
  icon,
  label,
  value,
  caption
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  caption: string;
}) => (
  <section className="metric-tile">
    <div className="metric-icon">{icon}</div>
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{caption}</p>
    </div>
  </section>
);

const JobHistory = ({ jobs, isAdmin }: { jobs: JobRecord[]; isAdmin: boolean }) => (
  <section className="history-panel">
    <div className="panel-heading">
      <Database size={18} />
      <h2>{isAdmin ? "All Applications" : "My Applications"}</h2>
    </div>
    {jobs.length === 0 ? (
      <p className="muted">No stored analyses yet.</p>
    ) : (
      <div className="job-list">
        {jobs.slice(0, 6).map((job) => (
          <article className="job-row" key={job.id}>
            <div>
              <strong>{job.jobTitle}</strong>
              <span>
                {job.applicationDate} | {job.status}
              </span>
              {isAdmin && job.userEmail && <span>{job.userName} | {job.userEmail}</span>}
            </div>
            <JobFitBadge job={job} />
            {job.llmRecommendation && <p>{job.llmRecommendation}</p>}
            {job.errorMessage && <p className="job-error">{job.errorMessage}</p>}
          </article>
        ))}
      </div>
    )}
  </section>
);

const ApplicationMeta = ({
  label,
  value
}: {
  label: string;
  value?: string | number;
}) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return (
    <div className="application-meta-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
};

const ApplicationAnalysisList = ({
  title,
  items
}: {
  title: string;
  items: string[];
}) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="application-detail-block">
      <h3>{title}</h3>
      <ul className="application-detail-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
};

const ApplicationAnalysisDetails = ({ analysis }: { analysis: ResumeAnalysis }) => (
  <div className="application-analysis-grid">
    <section className="application-detail-block application-summary-block">
      <h3>Candidate summary</h3>
      <p>{analysis.candidateSummary}</p>
    </section>
    <ApplicationAnalysisList title="Strengths" items={analysis.strengths} />
    <ApplicationAnalysisList title="Gaps" items={analysis.gaps} />
    <ApplicationAnalysisList title="Risks" items={analysis.risks} />
    <ApplicationAnalysisList title="Recommendations" items={analysis.recommendations} />
    <ApplicationAnalysisList title="Keywords" items={analysis.suggestedKeywords} />
    <ApplicationAnalysisList title="Interview questions" items={analysis.interviewQuestions} />
    {analysis.evidence.length > 0 && (
      <section className="application-detail-block application-summary-block">
        <h3>Ranked evidence</h3>
        <div className="application-evidence-list">
          {analysis.evidence.map((chunk) => (
            <article className="application-evidence-row" key={chunk.id}>
              <div>
                <strong>Chunk {chunk.id}</strong>
                <span>{evidenceRelevanceLabel(chunk.score)}</span>
              </div>
              <p>{chunk.text}</p>
            </article>
          ))}
        </div>
      </section>
    )}
  </div>
);

const ProfileApplications = ({
  jobs,
  isAdmin,
  onUseJob
}: {
  jobs: JobRecord[];
  isAdmin: boolean;
  onUseJob: (job: JobRecord) => void;
}) => {
  const [expandedJobId, setExpandedJobId] = useState<number | null>(jobs[0]?.id ?? null);

  useEffect(() => {
    setExpandedJobId((current) => current ?? jobs[0]?.id ?? null);
  }, [jobs]);

  return (
    <section className="surface-card full">
      <div className="panel-heading split-heading">
        <div>
          <Database size={19} />
          <h2>{isAdmin ? "All Application Details" : "My Application Details"}</h2>
        </div>
        <StatusBadge>{jobs.length} total</StatusBadge>
      </div>

      {jobs.length === 0 ? (
        <p className="muted">No applications saved yet.</p>
      ) : (
        <div className="application-list">
          {jobs.map((job) => {
            const expanded = expandedJobId === job.id;
            const analysis = job.analysis;
            return (
              <article className={`application-card${expanded ? " expanded" : ""}`} key={job.id}>
                <button
                  className="application-summary"
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setExpandedJobId(expanded ? null : job.id)}
                >
                  <span className="application-chevron">
                    {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </span>
                  <span className="application-title">
                    <strong>{job.jobTitle}</strong>
                    <span>
                      {job.applicationDate} | {job.status}
                      {job.jobPostingTitle ? ` | ${job.jobPostingTitle}` : ""}
                    </span>
                    {isAdmin && job.userEmail && (
                      <span>{job.userName ?? "Candidate"} | {job.userEmail}</span>
                    )}
                  </span>
                  <JobFitBadge job={job} />
                </button>

                {!expanded && job.llmRecommendation && (
                  <p className="application-preview">{job.llmRecommendation}</p>
                )}

                {expanded && (
                  <div className="application-details">
                    <div className="application-meta-grid">
                      <ApplicationMeta label="Posting" value={job.jobPostingTitle} />
                      <ApplicationMeta label="Resume" value={job.resumeFileName} />
                      <ApplicationMeta label="Resume size" value={job.characterCount ? `${job.characterCount} chars` : undefined} />
                      <ApplicationMeta label="Evidence chunks" value={job.chunkCount} />
                      <ApplicationMeta label="LLM model" value={job.llmModel} />
                      <ApplicationMeta label="Embedding model" value={job.embeddingModel} />
                      <ApplicationMeta label="Created" value={job.createdAt} />
                      <ApplicationMeta label="Updated" value={job.updatedAt} />
                    </div>

                    {analysis && <ApplicationAnalysisDetails analysis={analysis} />}

                    {job.llmRecommendation && (
                      <section className="application-detail-block">
                        <h3>LLM recommendation</h3>
                        <p>{job.llmRecommendation}</p>
                      </section>
                    )}

                    {job.jobDescription && (
                      <section className="application-detail-block">
                        <h3>Job description</h3>
                        <p>{job.jobDescription}</p>
                      </section>
                    )}

                    {job.errorMessage && (
                      <section className="application-detail-block danger">
                        <h3>Analysis error</h3>
                        <p>{job.errorMessage}</p>
                      </section>
                    )}

                    <button className="secondary-button application-action" type="button" onClick={() => onUseJob(job)}>
                      <Target size={16} />
                      Use for new analysis
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

const AdminOverview = ({ overview }: { overview: AdminOverviewResponse }) => (
  <section className="admin-overview">
    <div className="panel-heading">
      <ShieldCheck size={19} />
      <h2>Admin Overview</h2>
    </div>
    <div className="empty-grid admin-metrics">
      <MetricTile
        icon={<UsersRound size={17} />}
        label="Users"
        value={`${overview.stats.userCount}`}
        caption="registered accounts"
      />
      <MetricTile
        icon={<ClipboardList size={17} />}
        label="Applications"
        value={`${overview.stats.jobCount}`}
        caption={`${overview.stats.completedJobCount} completed`}
      />
      <MetricTile
        icon={<BriefcaseBusiness size={17} />}
        label="Postings"
        value={`${overview.stats.jobPostingCount}`}
        caption="admin-created roles"
      />
      <MetricTile
        icon={<AlertCircle size={17} />}
        label="Failures"
        value={`${overview.stats.failedJobCount}`}
        caption="analysis errors"
      />
    </div>
    <div className="admin-grid">
      <section className="surface-card">
        <div className="panel-heading">
          <UsersRound size={18} />
          <h2>Users</h2>
        </div>
        <div className="admin-list">
          {overview.users.map((user) => (
            <article className="admin-row" key={user.id}>
              <div>
                <strong>{user.name}</strong>
                <span>{user.email}</span>
              </div>
              <StatusBadge tone={user.role === "admin" ? "success" : "neutral"}>
                {user.role}
              </StatusBadge>
              <p>{user.applicationCount} applications</p>
            </article>
          ))}
        </div>
      </section>
      <section className="surface-card">
        <div className="panel-heading">
          <BriefcaseBusiness size={18} />
          <h2>Job Postings</h2>
        </div>
        <div className="admin-list">
          {overview.jobPostings.slice(0, 10).map((posting) => (
            <article className="admin-row" key={posting.id}>
              <div>
                <strong>{posting.title}</strong>
                <span>{posting.status} | {posting.createdAt}</span>
              </div>
              <StatusBadge tone={posting.status === "active" ? "success" : "neutral"}>
                {posting.matchCount ?? 0} matches
              </StatusBadge>
              <StatusBadge tone={posting.topFitScore && posting.topFitScore >= 80 ? "success" : "neutral"}>
                Top {posting.topFitScore ?? 0}/100
              </StatusBadge>
              {posting.skills.length > 0 && (
                <div className="tag-list compact-tags">
                  {posting.skills.slice(0, 6).map((skill) => (
                    <span className="tag-chip" key={skill}>{skill}</span>
                  ))}
                </div>
              )}
              <p>{posting.description}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="surface-card">
        <div className="panel-heading">
          <Target size={18} />
          <h2>Candidate Matches</h2>
        </div>
        <div className="admin-list">
          {overview.jobs.slice(0, 10).map((job) => (
            <article className="admin-row" key={job.id}>
              <div>
                <strong>{job.jobTitle}</strong>
                <span>{job.userEmail ?? "Unassigned"} | {job.applicationDate}</span>
                {job.jobPostingTitle && <span>Posting: {job.jobPostingTitle}</span>}
              </div>
              <StatusBadge tone={job.status === "completed" ? "success" : job.status === "failed" ? "danger" : "warning"}>
                {job.status}
              </StatusBadge>
              <JobFitBadge job={job} />
              <p>{job.llmRecommendation || job.jobDescription || "No details stored."}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  </section>
);

export const App = () => {
  const [file, setFile] = useState<File | null>(null);
  const [jobTitle, setJobTitle] = useState("Senior Software Engineer");
  const [applicationDate, setApplicationDate] = useState(today());
  const [jobDescription, setJobDescription] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [jobPostings, setJobPostings] = useState<JobPostingRecord[]>([]);
  const [selectedJobPostingId, setSelectedJobPostingId] = useState("");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [token, setToken] = useState(() => localStorage.getItem(authStorageKey) || "");
  const [user, setUser] = useState<UserRecord | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [loginEmail, setLoginEmail] = useState("admin@example.com");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginStatus, setLoginStatus] = useState<Status>("idle");
  const [loginError, setLoginError] = useState("");
  const [adminOverview, setAdminOverview] = useState<AdminOverviewResponse | null>(null);
  const [activeView, setActiveView] = useState<"dashboard" | "profile" | "adminJobs">("dashboard");
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileStatus, setProfileStatus] = useState<Status>("idle");
  const [profileError, setProfileError] = useState("");
  const [resumeVersions, setResumeVersions] = useState<ResumeVersionRecord[]>([]);
  const [resumeUploadFile, setResumeUploadFile] = useState<File | null>(null);
  const [resumeUploadInputKey, setResumeUploadInputKey] = useState(0);
  const [resumeUploadStatus, setResumeUploadStatus] = useState<Status>("idle");
  const [resumeUploadError, setResumeUploadError] = useState("");
  const [registrationName, setRegistrationName] = useState("");
  const [registrationEmail, setRegistrationEmail] = useState("");
  const [registrationPassword, setRegistrationPassword] = useState("");
  const [registrationStatus, setRegistrationStatus] = useState<Status>("idle");
  const [registrationError, setRegistrationError] = useState("");
  const [registeredUser, setRegisteredUser] = useState<UserRecord | null>(null);
  const [newPostingTitle, setNewPostingTitle] = useState("");
  const [newPostingDescription, setNewPostingDescription] = useState("");
  const [newPostingSkill, setNewPostingSkill] = useState("");
  const [newPostingSkills, setNewPostingSkills] = useState<string[]>([]);
  const [postingStatus, setPostingStatus] = useState<Status>("idle");
  const [postingError, setPostingError] = useState("");

  const authHeaders = (activeToken = token) => ({
    Authorization: `Bearer ${activeToken}`
  });

  const persistSession = (nextUser: UserRecord, nextToken: string) => {
    localStorage.setItem(authStorageKey, nextToken);
    setToken(nextToken);
    setUser(nextUser);
    setProfileName(nextUser.name);
    setProfileEmail(nextUser.email);
    setActiveView("dashboard");
  };

  const clearSession = () => {
    localStorage.removeItem(authStorageKey);
    setToken("");
    setUser(null);
    setJobs([]);
    setJobPostings([]);
    setAdminOverview(null);
    setResult(null);
    setActiveView("dashboard");
    setProfileName("");
    setProfileEmail("");
    setResumeVersions([]);
  };

  const loadJobs = async (activeToken = token) => {
    if (!activeToken) {
      setJobs([]);
      return;
    }

    const response = await fetch("/api/jobs", {
      headers: authHeaders(activeToken)
    });
    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as JobsResponse;
    setJobs(data.jobs);
  };

  const loadAdminOverview = async (activeToken = token) => {
    if (!activeToken) {
      setAdminOverview(null);
      return;
    }

    const response = await fetch("/api/admin/overview", {
      headers: authHeaders(activeToken)
    });
    if (!response.ok) {
      setAdminOverview(null);
      return;
    }

    setAdminOverview((await response.json()) as AdminOverviewResponse);
  };

  const loadJobPostings = async (activeToken = token) => {
    if (!activeToken) {
      setJobPostings([]);
      return;
    }

    const response = await fetch("/api/job-postings", {
      headers: authHeaders(activeToken)
    });
    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as JobPostingsResponse;
    setJobPostings(data.jobPostings);
  };

  const loadProfile = async (activeToken = token) => {
    if (!activeToken) {
      setResumeVersions([]);
      return;
    }

    const response = await fetch("/api/profile", {
      headers: authHeaders(activeToken)
    });
    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as ProfileResponse;
    setUser(data.user);
    setProfileName(data.user.name);
    setProfileEmail(data.user.email);
    setResumeVersions(data.resumes);
  };

  const loadHealth = async () => {
    const response = await fetch("/api/health");
    if (!response.ok) {
      return;
    }

    setHealth((await response.json()) as HealthResponse);
  };

  useEffect(() => {
    void loadHealth();
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    const loadSession = async () => {
      const response = await fetch("/api/me", {
        headers: authHeaders(token)
      });
      if (!response.ok) {
        clearSession();
        return;
      }

      const data = (await response.json()) as { user: UserRecord };
      setUser(data.user);
      setProfileName(data.user.name);
      setProfileEmail(data.user.email);
      await loadJobs(token);
      await loadJobPostings(token);
      await loadProfile(token);
      if (data.user.role === "admin") {
        await loadAdminOverview(token);
      }
    };

    void loadSession();
  }, []);

  useEffect(() => {
    const selectedPosting = jobPostings.find((posting) => String(posting.id) === selectedJobPostingId);
    if (!selectedPosting) {
      return;
    }

    setJobTitle(selectedPosting.title);
    setJobDescription(selectedPosting.description);
  }, [jobPostings, selectedJobPostingId]);

  const fileLabel = useMemo(() => {
    if (!file) {
      return "PDF, DOCX, TXT, or MD";
    }

    return `${file.name} (${Math.ceil(file.size / 1024)} KB)`;
  }, [file]);

  const resumeUploadLabel = useMemo(() => {
    if (!resumeUploadFile) {
      return "Upload a new resume version";
    }

    return `${resumeUploadFile.name} (${Math.ceil(resumeUploadFile.size / 1024)} KB)`;
  }, [resumeUploadFile]);

  const analyze = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setResult(null);

    if (!file) {
      setStatus("error");
      setError("Upload a resume before running the analysis.");
      return;
    }

    if (!token || !user) {
      setStatus("error");
      setError("Sign in before running an analysis.");
      return;
    }

    const payload = new FormData();
    payload.set("resume", file);
    if (selectedJobPostingId) {
      payload.set("jobPostingId", selectedJobPostingId);
    }
    payload.set("jobTitle", jobTitle);
    payload.set("applicationDate", applicationDate);
    payload.set("jobDescription", jobDescription);

    setStatus("loading");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: authHeaders(),
        body: payload
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed.");
      }

      setResult(data);
      setStatus("success");
      void loadJobs();
      void loadJobPostings();
      if (user.role === "admin") {
        void loadAdminOverview();
      }
      void loadHealth();
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Analysis failed.");
    }
  };

  const login = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError("");
    setLoginStatus("loading");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed.");
      }

      const session = data as LoginResponse;
      persistSession(session.user, session.token);
      setLoginPassword("");
      setLoginStatus("success");
      await loadJobs(session.token);
      await loadJobPostings(session.token);
      await loadProfile(session.token);
      if (session.user.role === "admin") {
        await loadAdminOverview(session.token);
      }
    } catch (caught) {
      setLoginStatus("error");
      setLoginError(caught instanceof Error ? caught.message : "Login failed.");
    }
  };

  const logout = async () => {
    if (token) {
      await fetch("/api/logout", {
        method: "POST",
        headers: authHeaders()
      });
    }

    clearSession();
    setLoginStatus("idle");
    setRegistrationStatus("idle");
  };

  const register = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRegistrationError("");
    setRegisteredUser(null);
    setRegistrationStatus("loading");

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: registrationName,
          email: registrationEmail,
          password: registrationPassword
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Registration failed.");
      }

      const registered = data as RegisterResponse;
      persistSession(registered.user, registered.token);
      setRegisteredUser(registered.user);
      setRegistrationStatus("success");
      setRegistrationPassword("");
      await loadJobs(registered.token);
      await loadJobPostings(registered.token);
      await loadProfile(registered.token);
    } catch (caught) {
      setRegistrationStatus("error");
      setRegistrationError(caught instanceof Error ? caught.message : "Registration failed.");
    }
  };

  const openProfile = async () => {
    setActiveView("profile");
    await loadProfile();
  };

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileError("");
    setProfileStatus("loading");

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: profileName,
          email: profileEmail
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Profile update failed.");
      }

      const updated = data as UpdateProfileResponse;
      setUser(updated.user);
      setProfileName(updated.user.name);
      setProfileEmail(updated.user.email);
      setProfileStatus("success");
    } catch (caught) {
      setProfileStatus("error");
      setProfileError(caught instanceof Error ? caught.message : "Profile update failed.");
    }
  };

  const uploadResumeVersion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResumeUploadError("");

    if (!resumeUploadFile) {
      setResumeUploadStatus("error");
      setResumeUploadError("Choose a resume file to upload.");
      return;
    }

    const payload = new FormData();
    payload.set("resume", resumeUploadFile);
    setResumeUploadStatus("loading");

    try {
      const response = await fetch("/api/resumes", {
        method: "POST",
        headers: authHeaders(),
        body: payload
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Resume upload failed.");
      }

      const uploaded = data as UploadResumeResponse;
      setResumeVersions((current) => [uploaded.resume, ...current]);
      setResumeUploadFile(null);
      setResumeUploadInputKey((current) => current + 1);
      setResumeUploadStatus("success");
    } catch (caught) {
      setResumeUploadStatus("error");
      setResumeUploadError(caught instanceof Error ? caught.message : "Resume upload failed.");
    }
  };

  const addPostingSkill = () => {
    const skill = newPostingSkill.trim();
    if (!skill || newPostingSkills.includes(skill)) {
      setNewPostingSkill("");
      return;
    }

    setNewPostingSkills((current) => [...current, skill]);
    setNewPostingSkill("");
  };

  const removePostingSkill = (skill: string) => {
    setNewPostingSkills((current) => current.filter((item) => item !== skill));
  };

  const createPosting = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPostingError("");
    setPostingStatus("loading");

    try {
      const response = await fetch("/api/admin/job-postings", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: newPostingTitle,
          description: newPostingDescription,
          skills: newPostingSkills
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Job posting creation failed.");
      }

      const created = data as CreateJobPostingResponse;
      setJobPostings((current) => [created.jobPosting, ...current]);
      setSelectedJobPostingId(String(created.jobPosting.id));
      setNewPostingTitle("");
      setNewPostingDescription("");
      setNewPostingSkills([]);
      setNewPostingSkill("");
      setPostingStatus("success");
      await loadAdminOverview();
    } catch (caught) {
      setPostingStatus("error");
      setPostingError(caught instanceof Error ? caught.message : "Job posting creation failed.");
    }
  };

  const useJobForNewAnalysis = (job: JobRecord) => {
    const activePosting = job.jobPostingId
      ? jobPostings.find((posting) => posting.id === job.jobPostingId && posting.status === "active")
      : undefined;

    setJobTitle(job.jobTitle);
    setApplicationDate(job.applicationDate);
    setJobDescription(job.jobDescription ?? "");
    setSelectedJobPostingId(activePosting ? String(activePosting.id) : "");
    setActiveView("dashboard");
  };

  if (!user) {
    return (
      <main className="app-shell">
        <header className="top-bar">
          <div className="title-row">
            <div className="brand-mark">
              <Sparkles size={22} />
            </div>
            <div>
              <h1>Resume Analyzer</h1>
              <p>Role-fit intelligence with versioned resumes and application history.</p>
            </div>
          </div>
          <div className="system-strip">
            <StatusBadge tone={health?.storage?.postgres.ok ? "success" : "warning"}>
              <Server size={14} />
              {health?.storage?.postgres.ok ? "pgvector ready" : "Postgres offline"}
            </StatusBadge>
            <StatusBadge>
              <Activity size={14} />
              {health?.models.embedding ?? "Embeddings"}
            </StatusBadge>
          </div>
        </header>

        <section className="auth-page">
          <section className="auth-panel">
            <div className="panel-heading">
              {authMode === "login" ? <LogIn size={20} /> : <UserPlus size={20} />}
              <h2>{authMode === "login" ? "Sign in" : "Create account"}</h2>
            </div>

            <div className="segmented-control">
              <button
                className={authMode === "login" ? "active" : ""}
                type="button"
                onClick={() => setAuthMode("login")}
              >
                <LogIn size={16} />
                Login
              </button>
              <button
                className={authMode === "register" ? "active" : ""}
                type="button"
                onClick={() => setAuthMode("register")}
              >
                <UserPlus size={16} />
                Register
              </button>
            </div>

            {authMode === "login" ? (
              <form className="form-stack" onSubmit={login}>
                <label className="field">
                  <span>Email</span>
                  <div className="input-with-icon">
                    <Mail size={18} />
                    <input
                      autoComplete="email"
                      inputMode="email"
                      type="email"
                      value={loginEmail}
                      onChange={(event) => setLoginEmail(event.target.value)}
                      placeholder="admin@example.com"
                    />
                  </div>
                </label>

                <label className="field">
                  <span>Password</span>
                  <div className="input-with-icon">
                    <LockKeyhole size={18} />
                    <input
                      autoComplete="current-password"
                      type="password"
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      placeholder="Account password"
                    />
                  </div>
                </label>

                <button className="primary-button" disabled={loginStatus === "loading"} type="submit">
                  {loginStatus === "loading" ? <Loader2 className="spin" size={18} /> : <LogIn size={18} />}
                  Sign in
                </button>
              </form>
            ) : (
              <form className="form-stack" onSubmit={register}>
                <label className="field">
                  <span>Name</span>
                  <div className="input-with-icon">
                    <UserRound size={18} />
                    <input
                      autoComplete="name"
                      value={registrationName}
                      onChange={(event) => setRegistrationName(event.target.value)}
                      placeholder="Jane Doe"
                    />
                  </div>
                </label>

                <label className="field">
                  <span>Email</span>
                  <div className="input-with-icon">
                    <Mail size={18} />
                    <input
                      autoComplete="email"
                      inputMode="email"
                      type="email"
                      value={registrationEmail}
                      onChange={(event) => setRegistrationEmail(event.target.value)}
                      placeholder="jane@example.com"
                    />
                  </div>
                </label>

                <label className="field">
                  <span>Password</span>
                  <div className="input-with-icon">
                    <LockKeyhole size={18} />
                    <input
                      autoComplete="new-password"
                      type="password"
                      value={registrationPassword}
                      onChange={(event) => setRegistrationPassword(event.target.value)}
                      placeholder="12+ chars, mixed case, number"
                    />
                  </div>
                </label>

                <button className="primary-button" disabled={registrationStatus === "loading"} type="submit">
                  {registrationStatus === "loading" ? <Loader2 className="spin" size={18} /> : <UserPlus size={18} />}
                  Create account
                </button>
              </form>
            )}

            {loginStatus === "error" && (
              <div className="notice error">
                <AlertCircle size={18} />
                <span>{loginError}</span>
              </div>
            )}

            {registrationStatus === "error" && (
              <div className="notice error">
                <AlertCircle size={18} />
                <span>{registrationError}</span>
              </div>
            )}
          </section>

          <section className="auth-context">
            <div className="empty-mark">
              <Archive size={34} />
            </div>
            <h2>Version resumes before applications</h2>
            <p>Profiles keep every uploaded resume as its own version, so updates never overwrite prior history.</p>
            <div className="empty-grid">
              <MetricTile icon={<FileText size={17} />} label="Resumes" value="Versioned" caption="append-only uploads" />
              <MetricTile icon={<BriefcaseBusiness size={17} />} label="Applications" value="Scoped" caption="visible by account" />
              <MetricTile icon={<ShieldCheck size={17} />} label="Admins" value="Global" caption="users and jobs" />
            </div>
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div className="title-row">
          <div className="brand-mark">
            <Sparkles size={22} />
          </div>
          <div>
            <h1>Resume Analyzer</h1>
            <p>Role-fit intelligence with stored jobs and vector evidence.</p>
          </div>
        </div>
        <div className="system-strip">
          <StatusBadge tone="success">
            <Database size={14} />
            PostgreSQL
          </StatusBadge>
          <StatusBadge tone={health?.storage?.postgres.ok ? "success" : "warning"}>
            <Server size={14} />
            {health?.storage?.postgres.ok ? "pgvector ready" : "Postgres offline"}
          </StatusBadge>
          <StatusBadge>
            <Activity size={14} />
            {health?.models.embedding ?? "Embeddings"}
          </StatusBadge>
          <button className="nav-button" type="button" onClick={() => setActiveView("dashboard")}>
            <ClipboardList size={16} />
            Dashboard
          </button>
          {user.role === "admin" && (
            <button className="nav-button primary-nav" type="button" onClick={() => setActiveView("adminJobs")}>
              <BriefcaseBusiness size={16} />
              Add jobs
            </button>
          )}
          <button className="nav-button" type="button" onClick={openProfile}>
            <UserRound size={16} />
            Profile
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className="input-column">
          <section className="account-panel">
            <div className="section-kicker">
              <span>Account</span>
              <StatusBadge tone={user ? "success" : "neutral"}>
                {user ? user.role : authMode}
              </StatusBadge>
            </div>

            {user ? (
              <div className="signed-in-card">
                <div>
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                </div>
                <button className="secondary-button" type="button" onClick={openProfile}>
                  <UserRound size={18} />
                  Profile
                </button>
                <button className="secondary-button" type="button" onClick={logout}>
                  <LogOut size={18} />
                  Sign out
                </button>
              </div>
            ) : (
              <>
                <div className="segmented-control">
                  <button
                    className={authMode === "login" ? "active" : ""}
                    type="button"
                    onClick={() => setAuthMode("login")}
                  >
                    <LogIn size={16} />
                    Login
                  </button>
                  <button
                    className={authMode === "register" ? "active" : ""}
                    type="button"
                    onClick={() => setAuthMode("register")}
                  >
                    <UserPlus size={16} />
                    Register
                  </button>
                </div>

                {authMode === "login" ? (
                  <form className="form-stack compact" onSubmit={login}>
                    <label className="field">
                      <span>Email</span>
                      <div className="input-with-icon">
                        <Mail size={18} />
                        <input
                          autoComplete="email"
                          inputMode="email"
                          type="email"
                          value={loginEmail}
                          onChange={(event) => setLoginEmail(event.target.value)}
                          placeholder="admin@example.com"
                        />
                      </div>
                    </label>

                    <label className="field">
                      <span>Password</span>
                      <div className="input-with-icon">
                        <LockKeyhole size={18} />
                        <input
                          autoComplete="current-password"
                          type="password"
                          value={loginPassword}
                          onChange={(event) => setLoginPassword(event.target.value)}
                          placeholder="Account password"
                        />
                      </div>
                    </label>

                    <button className="secondary-button" disabled={loginStatus === "loading"} type="submit">
                      {loginStatus === "loading" ? <Loader2 className="spin" size={18} /> : <LogIn size={18} />}
                      Sign in
                    </button>
                  </form>
                ) : (
                  <form className="form-stack compact" onSubmit={register}>
                    <label className="field">
                      <span>Name</span>
                      <div className="input-with-icon">
                        <UserRound size={18} />
                        <input
                          autoComplete="name"
                          value={registrationName}
                          onChange={(event) => setRegistrationName(event.target.value)}
                          placeholder="Jane Doe"
                        />
                      </div>
                    </label>

                    <label className="field">
                      <span>Email</span>
                      <div className="input-with-icon">
                        <Mail size={18} />
                        <input
                          autoComplete="email"
                          inputMode="email"
                          type="email"
                          value={registrationEmail}
                          onChange={(event) => setRegistrationEmail(event.target.value)}
                          placeholder="jane@example.com"
                        />
                      </div>
                    </label>

                    <label className="field">
                      <span>Password</span>
                      <div className="input-with-icon">
                        <LockKeyhole size={18} />
                        <input
                          autoComplete="new-password"
                          type="password"
                          value={registrationPassword}
                          onChange={(event) => setRegistrationPassword(event.target.value)}
                          placeholder="12+ chars, mixed case, number"
                        />
                      </div>
                    </label>

                    <button className="secondary-button" disabled={registrationStatus === "loading"} type="submit">
                      {registrationStatus === "loading" ? <Loader2 className="spin" size={18} /> : <UserPlus size={18} />}
                      Create account
                    </button>
                  </form>
                )}

                {registrationStatus === "success" && registeredUser && (
                  <div className="notice success">
                    <CheckCircle2 size={18} />
                    <span>{registeredUser.email} saved.</span>
                  </div>
                )}

                {registrationStatus === "error" && (
                  <div className="notice error">
                    <AlertCircle size={18} />
                    <span>{registrationError}</span>
                  </div>
                )}

                {loginStatus === "error" && (
                  <div className="notice error">
                    <AlertCircle size={18} />
                    <span>{loginError}</span>
                  </div>
                )}
              </>
            )}
          </section>

          <div className="section-kicker">
            <span>New analysis</span>
            <StatusBadge tone={!user ? "warning" : status === "loading" ? "warning" : "neutral"}>
              {!user ? "Login required" : status === "loading" ? "Running" : "Ready"}
            </StatusBadge>
          </div>

          <form className="form-stack" onSubmit={analyze}>
            <label className="upload-zone">
              <div className="upload-icon">
                <Upload size={22} />
              </div>
              <span>{fileLabel}</span>
              <input
                type="file"
                accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>

            <label className="field">
              <span>Job posting</span>
              <select
                value={selectedJobPostingId}
                onChange={(event) => setSelectedJobPostingId(event.target.value)}
              >
                <option value="">Custom job profile</option>
                {jobPostings
                  .filter((posting) => posting.status === "active")
                  .map((posting) => (
                    <option key={posting.id} value={posting.id}>
                      {posting.title}
                    </option>
                  ))}
              </select>
            </label>

            <label className="field">
              <span>Job title</span>
              <input
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
                placeholder="Product Manager, Data Analyst, Staff Engineer..."
              />
            </label>

            <label className="field">
              <span>Application date</span>
              <div className="input-with-icon">
                <CalendarDays size={18} />
                <input
                  value={applicationDate}
                  onChange={(event) => setApplicationDate(event.target.value)}
                  type="date"
                />
              </div>
            </label>

            <label className="field">
              <span>Job description</span>
              <textarea
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
                placeholder="Paste a job description for a more targeted review."
              />
            </label>

            <button className="primary-button" disabled={status === "loading" || !user} type="submit">
              {status === "loading" ? <Loader2 className="spin" size={18} /> : <Target size={18} />}
              Analyze resume
            </button>
          </form>

          {user?.role === "admin" && (
            <button className="primary-button sidebar-cta" type="button" onClick={() => setActiveView("adminJobs")}>
              <BriefcaseBusiness size={18} />
              Add or manage job postings
            </button>
          )}

          {status === "error" && (
            <div className="notice error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <JobHistory jobs={jobs} isAdmin={user?.role === "admin"} />
        </aside>

        <section className="results-column">
          {activeView === "adminJobs" && user.role === "admin" && (
            <div className="admin-jobs-view">
              <section className="surface-card full admin-job-form-panel">
                <div className="panel-heading split-heading">
                  <div>
                    <BriefcaseBusiness size={19} />
                    <h2>Add job posting</h2>
                  </div>
                  <StatusBadge tone={postingStatus === "loading" ? "warning" : "neutral"}>
                    {postingStatus === "loading" ? "Saving" : "Admin action"}
                  </StatusBadge>
                </div>

                <form className="form-stack profile-form" onSubmit={createPosting}>
                  <label className="field">
                    <span>Posting title</span>
                    <input
                      value={newPostingTitle}
                      onChange={(event) => setNewPostingTitle(event.target.value)}
                      placeholder="Backend Platform Engineer"
                    />
                  </label>

                  <label className="field">
                    <span>Required skills</span>
                    <div className="tag-entry">
                      <input
                        value={newPostingSkill}
                        onChange={(event) => setNewPostingSkill(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addPostingSkill();
                          }
                        }}
                        placeholder="Type a skill and press Enter"
                      />
                      <button className="secondary-button" type="button" onClick={addPostingSkill}>
                        <ArrowUpRight size={16} />
                        Add skill
                      </button>
                    </div>
                  </label>

                  {newPostingSkills.length > 0 && (
                    <div className="tag-list">
                      {newPostingSkills.map((skill) => (
                        <button key={skill} className="tag-chip removable" type="button" onClick={() => removePostingSkill(skill)}>
                          {skill}
                          <XCircle size={14} />
                        </button>
                      ))}
                    </div>
                  )}

                  <label className="field">
                    <span>Posting description</span>
                    <textarea
                      value={newPostingDescription}
                      onChange={(event) => setNewPostingDescription(event.target.value)}
                      placeholder="Paste the job posting requirements, responsibilities, and qualifications."
                    />
                  </label>

                  <button className="primary-button" disabled={postingStatus === "loading"} type="submit">
                    {postingStatus === "loading" ? <Loader2 className="spin" size={18} /> : <BriefcaseBusiness size={18} />}
                    Publish job posting
                  </button>
                </form>

                {postingStatus === "success" && (
                  <div className="notice success">
                    <CheckCircle2 size={18} />
                    <span>Job posting saved and selected for analysis.</span>
                  </div>
                )}

                {postingStatus === "error" && (
                  <div className="notice error">
                    <AlertCircle size={18} />
                    <span>{postingError}</span>
                  </div>
                )}
              </section>

              <section className="surface-card full">
                <div className="panel-heading split-heading">
                  <div>
                    <ClipboardList size={19} />
                    <h2>Job postings</h2>
                  </div>
                  <StatusBadge>{jobPostings.length} total</StatusBadge>
                </div>
                <div className="posting-grid">
                  {jobPostings.length === 0 ? (
                    <p className="muted">No job postings yet.</p>
                  ) : (
                    jobPostings.map((posting) => (
                      <article className="posting-card" key={posting.id}>
                        <div className="posting-card-header">
                          <div>
                            <strong>{posting.title}</strong>
                            <span>{posting.status} | {posting.createdAt}</span>
                          </div>
                          <StatusBadge tone={posting.status === "active" ? "success" : "neutral"}>
                            {posting.matchCount ?? 0} matches
                          </StatusBadge>
                        </div>
                        {posting.skills.length > 0 && (
                          <div className="tag-list">
                            {posting.skills.map((skill) => (
                              <span className="tag-chip" key={skill}>{skill}</span>
                            ))}
                          </div>
                        )}
                        <p>{posting.description}</p>
                        <div className="posting-metrics">
                          <StatusBadge>Avg {posting.averageFitScore ?? 0}/100</StatusBadge>
                          <StatusBadge tone={posting.topFitScore && posting.topFitScore >= 80 ? "success" : "neutral"}>
                            Top {posting.topFitScore ?? 0}/100
                          </StatusBadge>
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={() => {
                              setSelectedJobPostingId(String(posting.id));
                              setActiveView("dashboard");
                            }}
                          >
                            <Target size={16} />
                            Match resume
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}

          {activeView === "profile" && (
            <div className="profile-grid">
              <section className="surface-card full">
                <div className="panel-heading">
                  <UserRound size={19} />
                  <h2>User Profile</h2>
                </div>
                <form className="form-stack profile-form" onSubmit={saveProfile}>
                  <label className="field">
                    <span>Name</span>
                    <input
                      value={profileName}
                      onChange={(event) => setProfileName(event.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Email</span>
                    <input
                      inputMode="email"
                      type="email"
                      value={profileEmail}
                      onChange={(event) => setProfileEmail(event.target.value)}
                    />
                  </label>
                  <button className="primary-button" disabled={profileStatus === "loading"} type="submit">
                    {profileStatus === "loading" ? <Loader2 className="spin" size={18} /> : <CheckCircle2 size={18} />}
                    Save profile
                  </button>
                </form>

                {profileStatus === "success" && (
                  <div className="notice success">
                    <CheckCircle2 size={18} />
                    <span>Profile updated.</span>
                  </div>
                )}

                {profileStatus === "error" && (
                  <div className="notice error">
                    <AlertCircle size={18} />
                    <span>{profileError}</span>
                  </div>
                )}
              </section>

              <section className="surface-card full">
                <div className="panel-heading">
                  <Archive size={19} />
                  <h2>Resume Versions</h2>
                </div>
                <form className="form-stack profile-form" onSubmit={uploadResumeVersion}>
                  <label className="upload-zone">
                    <div className="upload-icon">
                      <Upload size={22} />
                    </div>
                    <span>{resumeUploadLabel}</span>
                    <input
                      key={resumeUploadInputKey}
                      type="file"
                      accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                      onChange={(event) => setResumeUploadFile(event.target.files?.[0] ?? null)}
                    />
                  </label>
                  <button className="secondary-button" disabled={resumeUploadStatus === "loading"} type="submit">
                    {resumeUploadStatus === "loading" ? <Loader2 className="spin" size={18} /> : <Upload size={18} />}
                    Upload new version
                  </button>
                </form>

                {resumeUploadStatus === "success" && (
                  <div className="notice success">
                    <CheckCircle2 size={18} />
                    <span>Resume version saved without replacing previous versions.</span>
                  </div>
                )}

                {resumeUploadStatus === "error" && (
                  <div className="notice error">
                    <AlertCircle size={18} />
                    <span>{resumeUploadError}</span>
                  </div>
                )}

                <div className="resume-version-list">
                  {resumeVersions.length === 0 ? (
                    <p className="muted">No resume versions uploaded yet.</p>
                  ) : (
                    resumeVersions.map((resume) => (
                      <article className="resume-version-row" key={resume.id}>
                        <div>
                          <strong>Version {resume.versionNumber}</strong>
                          <span>{resume.fileName}</span>
                        </div>
                        <StatusBadge>{Math.ceil(resume.characterCount / 1000)}k chars</StatusBadge>
                        <p>{resume.createdAt}</p>
                      </article>
                    ))
                  )}
                </div>
              </section>

              <ProfileApplications
                jobs={jobs}
                isAdmin={user.role === "admin"}
                onUseJob={useJobForNewAnalysis}
              />
            </div>
          )}

          {activeView === "dashboard" && user?.role === "admin" && adminOverview && !result && status !== "loading" && (
            <AdminOverview overview={adminOverview} />
          )}

          {activeView === "dashboard" && !result && status !== "loading" && !(user?.role === "admin" && adminOverview) && (
            <div className="empty-state">
              <div className="empty-mark">
                <SearchCheck size={34} />
              </div>
              <h2>{user ? "Ready for the next application" : "Sign in to review applications"}</h2>
              <p>
                {user
                  ? "Upload a resume and job context to generate a stored recommendation."
                  : "User accounts can review their resumes, applied jobs, and LLM match analysis."}
              </p>
              <div className="empty-grid">
                <MetricTile
                  icon={<Archive size={17} />}
                  label="Jobs"
                  value={`${jobs.length}`}
                  caption={user?.role === "admin" ? "all records" : "my records"}
                />
                <MetricTile
                  icon={<Server size={17} />}
                  label="Vectors"
                  value={health?.storage?.postgres.ok ? "Online" : "Offline"}
                  caption={health?.storage?.postgres.extension ?? "pgvector"}
                />
                <MetricTile
                  icon={<Layers3 size={17} />}
                  label="Model"
                  value="Local"
                  caption={health?.models.embedding ?? "embedding model"}
                />
              </div>
            </div>
          )}

          {activeView === "dashboard" && status === "loading" && (
            <div className="empty-state">
              <div className="empty-mark">
                <Loader2 className="spin" size={34} />
              </div>
              <h2>Analyzing resume</h2>
              <p>Parsing, embedding, storing evidence, and generating a recommendation.</p>
            </div>
          )}

          {activeView === "dashboard" && result && (
            <div className="analysis-grid">
              <section className="score-panel">
                <div>
                  <span className="eyebrow">{fitLabel(result.analysis.fitScore)}</span>
                  <h2>{result.analysis.fitScore}</h2>
                </div>
                <div className="summary-text">
                  <p>{result.analysis.candidateSummary}</p>
                  <span>
                    Job #{result.job.id} | {result.job.applicationDate} |{" "}
                    {result.resumeStats.fileName} | {result.resumeStats.chunkCount} chunks |{" "}
                    {result.models.embedding}
                  </span>
                </div>
              </section>

              <MetricTile
                icon={<BriefcaseBusiness size={17} />}
                label="Job"
                value={result.job.jobTitle}
                caption={result.job.applicationDate}
              />
              <MetricTile
                icon={<Database size={17} />}
                label="Storage"
                value="Persisted"
                caption={`Postgres job ${result.job.id}`}
              />
              <MetricTile
                icon={<Layers3 size={17} />}
                label="Evidence"
                value={`${result.analysis.evidence.length}`}
                caption="pgvector-ranked chunks"
              />
              <MetricTile
                icon={<Clock3 size={17} />}
                label="Status"
                value={result.job.status}
                caption={result.job.updatedAt}
              />

              <ListBlock
                title="Strengths"
                items={result.analysis.strengths}
                icon={<CheckCircle2 size={19} />}
              />
              <ListBlock
                title="Gaps"
                items={result.analysis.gaps}
                icon={<XCircle size={19} />}
              />
              <ListBlock
                title="Recommendations"
                items={result.analysis.recommendations}
                icon={<ArrowUpRight size={19} />}
              />
              <ListBlock
                title="Keywords"
                items={result.analysis.suggestedKeywords}
                icon={<BriefcaseBusiness size={19} />}
              />
              <ListBlock
                title="Interview Questions"
                items={result.analysis.interviewQuestions}
                icon={<FileText size={19} />}
              />

              <section className="surface-card full recommendation-panel">
                <div className="panel-heading">
                  <Sparkles size={19} />
                  <h2>LLM Recommendation</h2>
                </div>
                <p>{result.job.llmRecommendation || result.analysis.candidateSummary}</p>
              </section>

              <section className="surface-card full">
                <div className="panel-heading">
                  <Target size={19} />
                  <h2>Ranked Evidence</h2>
                </div>
                <div className="evidence-list">
                  {result.analysis.evidence.map((chunk) => (
                    <article className="evidence-card" key={chunk.id}>
                      <div>
                        <strong>Chunk {chunk.id}</strong>
                        <span>{evidenceRelevanceLabel(chunk.score)}</span>
                      </div>
                      <p>{chunk.text}</p>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          )}
        </section>
      </section>
    </main>
  );
};
