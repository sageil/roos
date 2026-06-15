import {
  Activity,
  AlertCircle,
  Archive,
  ArrowUpRight,
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock3,
  ClipboardList,
  Database,
  Download,
  Eye,
  EyeOff,
  FileText,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  Layers3,
  Loader2,
  Search,
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
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AdminUserDetailRecord,
  AdminUsersResponse,
  AdminOverviewResponse,
  AnalyzeResponse,
  CreateJobPostingResponse,
  JobRecord,
  JobPostingApplicationsResponse,
  JobPostingRecord,
  JobPostingsResponse,
  JobsResponse,
  LoginResponse,
  ProfileResponse,
  PrivacyPreviewResponse,
  RegisterResponse,
  RequirementAssessment,
  ResumeAnalysis,
  ResumeVersionRecord,
  SystemHealthResponse,
  UpdateProfileResponse,
  UploadResumeResponse,
  UserRecord
} from "../shared/types";

type Status = "idle" | "loading" | "success" | "error";
type ActiveView = "analysis" | "applications" | "jobs" | "profile" | "adminJobs" | "adminUsers" | "systemHealth";

const authStorageKey = "resume-analyzer-token";

const defaultAuthenticatedView: ActiveView = "applications";
const adminOnlyViews = new Set<ActiveView>(["adminJobs", "adminUsers", "systemHealth"]);
const passwordRuleLabels = {
  length: "At least 12 characters",
  lowercase: "One lowercase letter",
  uppercase: "One uppercase letter",
  number: "One number"
};

const routeForView: Record<ActiveView, string> = {
  analysis: "/analysis",
  applications: "/applications",
  jobs: "/jobs",
  profile: "/profile",
  adminJobs: "/admin/jobs",
  adminUsers: "/admin/users",
  systemHealth: "/admin/health"
};

const viewFromPath = (path: string): ActiveView => {
  const normalizedPath = path.replace(/\/+$/, "") || "/";
  switch (normalizedPath) {
    case "/":
    case "/applications":
      return "applications";
    case "/jobs":
      return "jobs";
    case "/profile":
      return "profile";
    case "/admin/jobs":
      return "adminJobs";
    case "/admin/users":
      return "adminUsers";
    case "/admin/health":
      return "systemHealth";
    case "/analysis":
      return "analysis";
    default:
      return defaultAuthenticatedView;
  }
};

type PrivacyRedactionForm = {
  name: string;
  emails: string;
  phones: string;
  addressLines: string;
  links: string;
};

const today = () => {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const defaultPrivacyRedactionForm = (user?: UserRecord | null): PrivacyRedactionForm => ({
  name: user?.name ?? "",
  emails: user?.email ?? "",
  phones: "",
  addressLines: "",
  links: ""
});

const splitPrivacyLines = (value: string) =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

const serializePrivacyRedactions = (form: PrivacyRedactionForm) => ({
  name: form.name.trim(),
  emails: splitPrivacyLines(form.emails),
  phones: splitPrivacyLines(form.phones),
  addressLines: splitPrivacyLines(form.addressLines),
  links: splitPrivacyLines(form.links)
});

const privacyPreviewToForm = (
  preview: PrivacyPreviewResponse,
  fallback: PrivacyRedactionForm
): PrivacyRedactionForm => ({
  name: preview.privacyRedactions.names[0] || preview.privacyRedactions.name || fallback.name,
  emails: (preview.privacyRedactions.emails.length > 0
    ? preview.privacyRedactions.emails
    : splitPrivacyLines(fallback.emails)
  ).join("\n"),
  phones: preview.privacyRedactions.phones.join("\n"),
  addressLines: preview.privacyRedactions.addressLines.join("\n"),
  links: preview.privacyRedactions.links.join("\n")
});

const redactionTotalLabel = (total: number) => `${total} privacy ${total === 1 ? "value" : "values"} removed`;

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.ceil(bytes / 1024)} KB`;
  }
  return `${bytes} bytes`;
};

const filenameFromContentDisposition = (header: string | null, fallback: string) => {
  const match = header?.match(/filename="([^"]+)"/i);
  return match?.[1] ?? fallback;
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

const PrivacyReviewFields = ({
  value,
  onChange,
  status = "idle",
  error = ""
}: {
  value: PrivacyRedactionForm;
  onChange: (value: PrivacyRedactionForm) => void;
  status?: Status;
  error?: string;
}) => {
  const update = (field: keyof PrivacyRedactionForm) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => onChange({ ...value, [field]: event.target.value });

  return (
    <section className="privacy-review">
      <div className="privacy-review-heading">
        <ShieldCheck size={18} />
        <div>
          <strong>Privacy review</strong>
          <span>
            {status === "loading"
              ? "Scanning the resume for personal details before storage and analysis."
              : "Confirm personal details to remove before storage and analysis."}
          </span>
        </div>
      </div>

      {error && (
        <div className="notice error compact-notice">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <label className="field compact-field">
        <span>Name to remove</span>
        <input value={value.name} onChange={update("name")} placeholder="Candidate name" />
      </label>

      <label className="field compact-field">
        <span>Emails to remove</span>
        <textarea
          className="compact-textarea"
          value={value.emails}
          onChange={update("emails")}
          placeholder="One email per line"
        />
      </label>

      <label className="field compact-field">
        <span>Phone numbers to remove</span>
        <textarea
          className="compact-textarea"
          value={value.phones}
          onChange={update("phones")}
          placeholder="One phone number per line"
        />
      </label>

      <label className="field compact-field">
        <span>Address lines to remove</span>
        <textarea
          className="compact-textarea"
          value={value.addressLines}
          onChange={update("addressLines")}
          placeholder="One confirmed address line per line"
        />
      </label>

      <label className="field compact-field">
        <span>Links to remove</span>
        <textarea
          className="compact-textarea"
          value={value.links}
          onChange={update("links")}
          placeholder="Portfolio, LinkedIn, or personal URLs"
        />
      </label>
    </section>
  );
};

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

const InterviewQuestionsEditor = ({
  questions,
  onSave,
  compact = false
}: {
  questions: string[];
  onSave: (questions: string[]) => Promise<void> | void;
  compact?: boolean;
}) => {
  const [draft, setDraft] = useState(questions.join("\n"));
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(questions.join("\n"));
    setStatus("idle");
    setError("");
  }, [questions]);

  const save = async () => {
    setStatus("loading");
    setError("");
    try {
      const nextQuestions = draft
        .split(/\r?\n/)
        .map((question) => question.trim())
        .filter(Boolean);
      await onSave(nextQuestions);
      setDraft(nextQuestions.join("\n"));
      setStatus("success");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Interview question update failed.");
    }
  };

  return (
    <section className={compact ? "application-detail-block" : "surface-card"}>
      <div className="panel-heading split-heading">
        <div>
          <ClipboardList size={compact ? 16 : 19} />
          <h2>Interview questions</h2>
        </div>
        {status === "success" && <StatusBadge tone="success">Saved</StatusBadge>}
      </div>
      <label className="field compact-field">
        <span>One question per line</span>
        <textarea
          className="compact-textarea interview-question-editor"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add interview questions for the hiring team"
        />
      </label>
      <button className="secondary-button compact-action" disabled={status === "loading"} type="button" onClick={() => void save()}>
        {status === "loading" ? <Loader2 className="spin" size={16} /> : <CheckCircle2 size={16} />}
        Save questions
      </button>
      {status === "error" && <p className="compact-notice error">{error}</p>}
    </section>
  );
};

const scoreBreakdownEntries = (analysis: ResumeAnalysis) => {
  return [
    ["Minimum qualifications", analysis.scoreBreakdown.minimumQualifications],
    ["Role competencies", analysis.scoreBreakdown.roleCompetencies],
    ["Domain experience", analysis.scoreBreakdown.domainExperience],
    ["Preferred qualifications", analysis.scoreBreakdown.preferredQualifications],
    ["Seniority and scope", analysis.scoreBreakdown.seniorityScope],
    ["Evidence quality", analysis.scoreBreakdown.evidenceQuality]
  ] as const;
};

const requirementCategoryLabel = (category: RequirementAssessment["category"]) => {
  const labels: Record<RequirementAssessment["category"], string> = {
    minimum: "Minimum qualification",
    role_competency: "Role competency",
    domain: "Domain experience",
    preferred: "Preferred",
    seniority: "Seniority/scope"
  };

  return labels[category];
};

const requirementImportanceLabel = (importance: RequirementAssessment["importance"]) => {
  const labels: Record<RequirementAssessment["importance"], string> = {
    must_have: "Must-have",
    preferred: "Preferred"
  };

  return labels[importance];
};

const requirementStatusLabel = (status: RequirementAssessment["status"]) => {
  const labels: Record<RequirementAssessment["status"], string> = {
    met: "Met",
    partially_met: "Partially met",
    not_evidenced: "Not evidenced"
  };

  return labels[status];
};

const requirementStatusTone = (status: RequirementAssessment["status"]) => {
  const tones: Record<RequirementAssessment["status"], "met" | "partial" | "missing"> = {
    met: "met",
    partially_met: "partial",
    not_evidenced: "missing"
  };

  return tones[status];
};

const HREvaluationDetails = ({
  analysis,
  compact = false
}: {
  analysis: ResumeAnalysis;
  compact?: boolean;
}) => {
  const scoreEntries = scoreBreakdownEntries(analysis);
  const sectionClass = compact ? "application-detail-block application-summary-block" : "surface-card full";

  return (
    <>
      <section className={sectionClass}>
        <div className="panel-heading">
          <ClipboardList size={19} />
          <h2>HR Score Breakdown</h2>
        </div>
        <div className="score-breakdown-grid">
          {scoreEntries.map(([label, value]) => (
            <div className="score-breakdown-item" key={label}>
              <span>{label}</span>
              <strong>{Math.round(value)}/100</strong>
            </div>
          ))}
        </div>
      </section>

      {analysis.requirementAssessments.length > 0 && (
        <section className={sectionClass}>
          <div className="panel-heading">
            <CheckCircle2 size={19} />
            <h2>Requirement Assessment</h2>
          </div>
          <div className="requirement-assessment-list">
            {analysis.requirementAssessments.map((item) => (
              <article className="requirement-assessment-row" key={`${item.category}-${item.requirement}`}>
                <div>
                  <strong>{item.requirement}</strong>
                  <div className="requirement-chip-row" aria-label="Requirement metadata">
                    <span className="requirement-chip category">{requirementCategoryLabel(item.category)}</span>
                    <span className="requirement-chip importance">{requirementImportanceLabel(item.importance)}</span>
                    <span className={`requirement-chip status ${requirementStatusTone(item.status)}`}>
                      {requirementStatusLabel(item.status)}
                    </span>
                  </div>
                </div>
                <p>{item.rationale}</p>
                {item.evidence.length > 0 && (
                  <ul>
                    {item.evidence.map((evidenceItem) => (
                      <li key={evidenceItem}>{evidenceItem}</li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      <section className={sectionClass}>
        <div className="panel-heading">
          <ShieldCheck size={19} />
          <h2>Fairness Review</h2>
        </div>
        {analysis.fairnessReview.ignoredFactors.length > 0 && (
          <div className="tag-list">
            {analysis.fairnessReview.ignoredFactors.map((factor) => (
              <span className="tag-chip" key={factor}>{factor}</span>
            ))}
          </div>
        )}
        {analysis.fairnessReview.notes.length > 0 ? (
          <ul className="item-list">
            {analysis.fairnessReview.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">No fairness notes returned.</p>
        )}
      </section>
    </>
  );
};

const ApplicationAnalysisDetails = ({
  analysis,
  isAdmin,
  onSaveInterviewQuestions
}: {
  analysis: ResumeAnalysis;
  isAdmin: boolean;
  onSaveInterviewQuestions?: (questions: string[]) => Promise<void> | void;
}) => (
  <div className="application-analysis-grid">
    <section className="application-detail-block application-summary-block">
      <h3>Candidate summary</h3>
      <p>{analysis.candidateSummary}</p>
    </section>
    <HREvaluationDetails analysis={analysis} compact />
    <ApplicationAnalysisList title="Strengths" items={analysis.strengths} />
    <ApplicationAnalysisList title="Gaps" items={analysis.gaps} />
    <ApplicationAnalysisList title="Risks" items={analysis.risks} />
    <ApplicationAnalysisList title="Recommendations" items={analysis.recommendations} />
    <ApplicationAnalysisList title="Keywords" items={analysis.suggestedKeywords} />
    {isAdmin && onSaveInterviewQuestions && (
      <InterviewQuestionsEditor
        compact
        questions={analysis.interviewQuestions}
        onSave={onSaveInterviewQuestions}
      />
    )}
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

const ApplicationDetailsBody = ({
  job,
  isAdmin,
  onUseJob,
  onDownloadAssessment,
  onSaveInterviewQuestions
}: {
  job: JobRecord;
  isAdmin: boolean;
  onUseJob?: (job: JobRecord) => void;
  onDownloadAssessment?: (job: JobRecord) => void;
  onSaveInterviewQuestions?: (job: JobRecord, questions: string[]) => Promise<void> | void;
}) => (
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

    {job.analysis && (
      <ApplicationAnalysisDetails
        analysis={job.analysis}
        isAdmin={isAdmin}
        onSaveInterviewQuestions={
          isAdmin && onSaveInterviewQuestions
            ? (questions) => onSaveInterviewQuestions(job, questions)
            : undefined
        }
      />
    )}

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

    {(onUseJob || (onDownloadAssessment && job.analysis)) && (
      <div className="application-actions">
        {onUseJob && (
          <button className="secondary-button application-action" type="button" onClick={() => onUseJob(job)}>
            <Target size={16} />
            Use for new analysis
          </button>
        )}
        {onDownloadAssessment && job.analysis && (
          <button
            className="secondary-button application-action"
            type="button"
            onClick={() => onDownloadAssessment(job)}
          >
            <Download size={16} />
            Download assessment
          </button>
        )}
      </div>
    )}
  </div>
);

const ProfileApplications = ({
  jobs,
  isAdmin,
  onUseJob,
  onDownloadAssessment,
  onSaveInterviewQuestions
}: {
  jobs: JobRecord[];
  isAdmin: boolean;
  onUseJob: (job: JobRecord) => void;
  onDownloadAssessment?: (job: JobRecord) => void;
  onSaveInterviewQuestions?: (job: JobRecord, questions: string[]) => Promise<void> | void;
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
                  <ApplicationDetailsBody
                    job={job}
                    isAdmin={isAdmin}
                    onUseJob={onUseJob}
                    onDownloadAssessment={isAdmin ? onDownloadAssessment : undefined}
                    onSaveInterviewQuestions={isAdmin ? onSaveInterviewQuestions : undefined}
                  />
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

const AdminUsersPanel = ({
  users,
  search,
  status,
  error,
  onSearchChange,
  onRefresh,
  onDownloadResume,
  onDownloadAssessment,
  onSaveInterviewQuestions
}: {
  users: AdminUserDetailRecord[];
  search: string;
  status: Status;
  error: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onDownloadResume: (resume: ResumeVersionRecord) => void;
  onDownloadAssessment: (job: JobRecord) => void;
  onSaveInterviewQuestions: (job: JobRecord, questions: string[]) => Promise<void> | void;
}) => {
  const [expandedApplicationId, setExpandedApplicationId] = useState<number | null>(null);

  useEffect(() => {
    setExpandedApplicationId(null);
  }, [users]);

  return (
    <section className="admin-users-view">
      <section className="surface-card full">
        <div className="panel-heading split-heading">
          <div>
            <UsersRound size={19} />
            <h2>Users</h2>
          </div>
          <StatusBadge tone={status === "loading" ? "warning" : "neutral"}>
            {status === "loading" ? "Searching" : `${users.length} shown`}
          </StatusBadge>
        </div>

        <div className="admin-user-toolbar">
          <label className="field">
            <span>Search users, skills, jobs, resumes, and match evidence</span>
            <div className="input-with-icon">
              <Search size={18} />
              <input
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="client intake, phone triage, anaesthetic monitoring..."
              />
            </div>
          </label>
          <button className="secondary-button" disabled={status === "loading"} type="button" onClick={onRefresh}>
            {status === "loading" ? <Loader2 className="spin" size={18} /> : <SearchCheck size={18} />}
            Apply filter
          </button>
        </div>

        {status === "error" && (
          <div className="notice error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <div className="admin-user-list">
          {users.length === 0 ? (
            <p className="muted">No users match the current filter.</p>
          ) : (
            users.map((adminUser) => {
              const latestResume = adminUser.latestResume;
              return (
                <article className="admin-user-card" key={adminUser.id}>
                  <div className="admin-user-header">
                    <div>
                      <strong>{adminUser.name}</strong>
                      <span>{adminUser.email}</span>
                    </div>
                    <div className="admin-user-badges">
                      <StatusBadge tone={adminUser.role === "admin" ? "success" : "neutral"}>
                        {adminUser.role}
                      </StatusBadge>
                      <StatusBadge>{adminUser.applicationCount} applications</StatusBadge>
                    </div>
                  </div>

                  <div className="admin-user-grid">
                    <section className="admin-user-section">
                      <h3>Latest resume</h3>
                      {latestResume ? (
                        <>
                          <strong>Version {latestResume.versionNumber}</strong>
                          <span>{latestResume.fileName}</span>
                          <p>
                            {formatFileSize(latestResume.fileSize)} |{" "}
                            {Math.ceil(latestResume.characterCount / 1000)}k chars |{" "}
                            {latestResume.createdAt}
                          </p>
                          <button
                            className="secondary-button compact-action"
                            type="button"
                            onClick={() => onDownloadResume(latestResume)}
                          >
                            <Download size={16} />
                            Download resume
                          </button>
                        </>
                      ) : (
                        <p className="muted">No resume uploaded.</p>
                      )}
                    </section>

                    <section className="admin-user-section">
                      <div className="section-title-row">
                        <h3>Matched terms</h3>
                        {adminUser.matchedTerms.length > 0 && (
                          <span>{adminUser.matchedTerms.length}</span>
                        )}
                      </div>
                      {adminUser.matchedTerms.length > 0 ? (
                        <div className="matched-term-list">
                          {adminUser.matchedTerms.slice(0, 12).map((term) => (
                            <span className="matched-term-chip" key={term}>{term}</span>
                          ))}
                        </div>
                      ) : (
                        <p className="muted">No matched terms yet.</p>
                      )}
                    </section>
                  </div>

                  <section className="admin-user-section">
                    <h3>Recent applications</h3>
                    {adminUser.recentApplications.length === 0 ? (
                      <p className="muted">No applications yet.</p>
                    ) : (
                      <div className="admin-user-applications">
                        {adminUser.recentApplications.map((job) => {
                          const expanded = expandedApplicationId === job.id;
                          return (
                            <article className={`application-card admin-user-application-card${expanded ? " expanded" : ""}`} key={job.id}>
                              <button
                                className="application-summary"
                                type="button"
                                aria-expanded={expanded}
                                onClick={() => setExpandedApplicationId(expanded ? null : job.id)}
                              >
                                <span className="application-chevron">
                                  {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                </span>
                                <span className="application-title">
                                  <strong>{job.jobTitle}</strong>
                                  <span>{job.applicationDate} | {job.status}</span>
                                  {job.jobPostingTitle && <span>Posting: {job.jobPostingTitle}</span>}
                                </span>
                                <JobFitBadge job={job} />
                              </button>

                              {!expanded && job.llmRecommendation && (
                                <p className="application-preview">{job.llmRecommendation}</p>
                              )}

                              {expanded && (
                                <ApplicationDetailsBody
                                  job={job}
                                  isAdmin
                                  onDownloadAssessment={onDownloadAssessment}
                                  onSaveInterviewQuestions={onSaveInterviewQuestions}
                                />
                              )}
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </article>
              );
            })
          )}
        </div>
      </section>
    </section>
  );
};

const PostingApplicationsPanel = ({
  posting,
  jobs,
  status,
  error,
  panelRef,
  onDownloadAssessment,
  onSaveInterviewQuestions
}: {
  posting?: JobPostingRecord;
  jobs: JobRecord[];
  status: Status;
  error: string;
  panelRef?: React.Ref<HTMLElement>;
  onDownloadAssessment?: (job: JobRecord) => void;
  onSaveInterviewQuestions?: (job: JobRecord, questions: string[]) => Promise<void> | void;
}) => {
  const [expandedJobId, setExpandedJobId] = useState<number | null>(jobs[0]?.id ?? null);

  useEffect(() => {
    setExpandedJobId(jobs[0]?.id ?? null);
  }, [jobs]);

  if (!posting && status === "idle") {
    return null;
  }

  return (
    <section className="surface-card full posting-applications-panel" ref={panelRef}>
      <div className="panel-heading split-heading">
        <div>
          <UsersRound size={19} />
          <h2>{posting ? `Applications for ${posting.title}` : "Posting applications"}</h2>
        </div>
        <StatusBadge tone={status === "loading" ? "warning" : "neutral"}>
          {status === "loading" ? "Loading" : `${jobs.length} shown`}
        </StatusBadge>
      </div>

      {status === "error" && (
        <div className="notice error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {status === "loading" ? (
        <div className="empty-state compact-empty">
          <div className="empty-mark">
            <Loader2 className="spin" size={34} />
          </div>
          <h2>Loading applications</h2>
          <p>Fetching candidates and stored LLM assessments for this posting.</p>
        </div>
      ) : jobs.length === 0 ? (
        <p className="muted">No applications for this posting yet.</p>
      ) : (
        <div className="application-list">
          {jobs.map((job) => {
            const expanded = expandedJobId === job.id;
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
                    <strong>{job.userName ?? "Candidate"}</strong>
                    <span>{job.userEmail ?? "No email"} | {job.applicationDate} | {job.status}</span>
                    <span>{job.jobTitle}</span>
                  </span>
                  <JobFitBadge job={job} />
                </button>

                {!expanded && job.llmRecommendation && (
                  <p className="application-preview">{job.llmRecommendation}</p>
                )}

                {expanded && (
	                  <ApplicationDetailsBody
	                    job={job}
	                    isAdmin
	                    onDownloadAssessment={onDownloadAssessment}
	                    onSaveInterviewQuestions={onSaveInterviewQuestions}
	                  />
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

const ApplicationSearchPanel = ({
  jobs,
  search,
  status,
  error,
  isAdmin,
  onSearchChange,
  onRefresh,
  onUseJob,
  onDownloadAssessment,
  onSaveInterviewQuestions
}: {
  jobs: JobRecord[];
  search: string;
  status: Status;
  error: string;
  isAdmin: boolean;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onUseJob: (job: JobRecord) => void;
  onDownloadAssessment?: (job: JobRecord) => void;
  onSaveInterviewQuestions?: (job: JobRecord, questions: string[]) => Promise<void> | void;
}) => {
  const [expandedJobId, setExpandedJobId] = useState<number | null>(jobs[0]?.id ?? null);

  useEffect(() => {
    setExpandedJobId(jobs[0]?.id ?? null);
  }, [jobs]);

  return (
    <section className="applications-view">
      <section className="surface-card full">
        <div className="panel-heading split-heading">
          <div>
            <Database size={19} />
            <h2>{isAdmin ? "Applications" : "My Applications"}</h2>
          </div>
          <StatusBadge tone={status === "loading" ? "warning" : "neutral"}>
            {status === "loading" ? "Searching" : `${jobs.length} shown`}
          </StatusBadge>
        </div>

        <div className="admin-user-toolbar">
          <label className="field">
            <span>Search applications by candidate, role, resume evidence, recommendations, or related meaning</span>
            <div className="input-with-icon">
              <Search size={18} />
              <input
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="client intake, phone triage, animal handling, veterinary technician..."
              />
            </div>
          </label>
          <button className="secondary-button" disabled={status === "loading"} type="button" onClick={onRefresh}>
            {status === "loading" ? <Loader2 className="spin" size={18} /> : <SearchCheck size={18} />}
            Search applications
          </button>
        </div>

        {status === "error" && (
          <div className="notice error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {status === "loading" ? (
          <div className="empty-state compact-empty">
            <div className="empty-mark">
              <Loader2 className="spin" size={34} />
            </div>
            <h2>Searching applications</h2>
            <p>Finding exact and semantic matches across stored assessments and resume evidence.</p>
          </div>
        ) : jobs.length === 0 ? (
          <p className="muted">No applications match the current search.</p>
        ) : (
          <div className="application-list">
            {jobs.map((job) => {
              const expanded = expandedJobId === job.id;
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
                    <ApplicationDetailsBody
                      job={job}
                      isAdmin={isAdmin}
                      onUseJob={onUseJob}
                      onDownloadAssessment={isAdmin ? onDownloadAssessment : undefined}
                      onSaveInterviewQuestions={isAdmin ? onSaveInterviewQuestions : undefined}
                    />
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
};

const JobSearchPanel = ({
  postings,
  search,
  status,
  error,
  selectedPostingId,
  selectedPostingApplications,
  selectedPostingApplicationsStatus,
  selectedPostingApplicationsError,
  onSearchChange,
  onRefresh,
  onUsePosting,
  onViewApplications,
  onDownloadAssessment,
  onSaveInterviewQuestions,
  isAdmin,
  hasResume
}: {
  postings: JobPostingRecord[];
  search: string;
  status: Status;
  error: string;
  selectedPostingId: number | null;
  selectedPostingApplications: JobRecord[];
  selectedPostingApplicationsStatus: Status;
  selectedPostingApplicationsError: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onUsePosting: (posting: JobPostingRecord) => void;
  onViewApplications?: (posting: JobPostingRecord) => void;
  onDownloadAssessment?: (job: JobRecord) => void;
  onSaveInterviewQuestions?: (job: JobRecord, questions: string[]) => Promise<void> | void;
  isAdmin: boolean;
  hasResume: boolean;
}) => {
  const applicationsPanelRef = useRef<HTMLElement | null>(null);
  const selectedPosting = selectedPostingId
    ? postings.find((posting) => posting.id === selectedPostingId)
    : undefined;

  useEffect(() => {
    if (!selectedPostingId) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      applicationsPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [selectedPostingId, selectedPostingApplicationsStatus]);

  return (
    <section className="jobs-view">
    <section className="surface-card full">
      <div className="panel-heading split-heading">
        <div>
          <SearchCheck size={19} />
          <h2>Find roles</h2>
        </div>
        <StatusBadge tone={status === "loading" ? "warning" : "neutral"}>
          {status === "loading" ? "Searching" : `${postings.length} shown`}
        </StatusBadge>
      </div>

      <div className="admin-user-toolbar">
        <label className="field">
          <span>Search roles by title, skills, responsibilities, or related meaning</span>
          <div className="input-with-icon">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="appointment scheduling, client intake, anaesthetic monitoring..."
            />
          </div>
        </label>
        <button className="secondary-button" disabled={status === "loading"} type="button" onClick={onRefresh}>
          {status === "loading" ? <Loader2 className="spin" size={18} /> : <SearchCheck size={18} />}
          Search roles
        </button>
      </div>

      {status === "error" && (
        <div className="notice error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="posting-grid">
        {postings.length === 0 ? (
          <p className="muted">No roles match the current search.</p>
        ) : (
          postings.map((posting) => (
            <article className="posting-card" key={posting.id}>
              <div className="posting-card-header">
                <div>
                  <strong>{posting.title}</strong>
                  <span>{posting.status} | {posting.createdAt}</span>
                </div>
                {onViewApplications ? (
                  <button
                    className={`status-badge application-count-button${selectedPostingId === posting.id ? " active" : ""}`}
                    type="button"
                    onClick={() => onViewApplications(posting)}
                  >
                    {posting.matchCount ?? 0} applications
                  </button>
                ) : (
                  <StatusBadge tone={posting.status === "active" ? "success" : "neutral"}>
                    {posting.matchCount ?? 0} applications
                  </StatusBadge>
                )}
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
                <button className="secondary-button" type="button" onClick={() => onUsePosting(posting)}>
                  {hasResume ? <Target size={16} /> : <Upload size={16} />}
                  {isAdmin ? "Analyze candidate" : hasResume ? "Apply" : "Upload resume to apply"}
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
    <PostingApplicationsPanel
      posting={selectedPosting}
      jobs={selectedPostingApplications}
      status={selectedPostingApplicationsStatus}
      error={selectedPostingApplicationsError}
      panelRef={applicationsPanelRef}
      onDownloadAssessment={onDownloadAssessment}
      onSaveInterviewQuestions={onSaveInterviewQuestions}
    />
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

const healthTone = (status: "online" | "degraded" | "offline"): "success" | "warning" | "danger" => {
  if (status === "online") {
    return "success";
  }
  if (status === "degraded") {
    return "warning";
  }
  return "danger";
};

const SystemHealthPanel = ({
  health,
  status,
  error,
  onRefresh
}: {
  health: SystemHealthResponse | null;
  status: Status;
  error: string;
  onRefresh: () => void;
}) => (
  <div className="system-health-view">
    <section className="surface-card full">
      <div className="panel-heading split-heading">
        <div>
          <Server size={19} />
          <h2>System Health</h2>
        </div>
        <div className="health-actions">
          {health && (
            <StatusBadge tone={health.ok ? "success" : "danger"}>
              {health.ok ? "All systems online" : "Action needed"}
            </StatusBadge>
          )}
          <button className="secondary-button compact-button" disabled={status === "loading"} type="button" onClick={onRefresh}>
            {status === "loading" ? <Loader2 className="spin" size={16} /> : <Activity size={16} />}
            Refresh
          </button>
        </div>
      </div>

      {status === "error" && (
        <div className="notice error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {health ? (
        <>
          <div className="health-summary-grid">
            <MetricTile
              icon={<Server size={17} />}
              label="Overall"
              value={health.ok ? "Online" : "Degraded"}
              caption={health.generatedAt}
            />
            <MetricTile
              icon={<Layers3 size={17} />}
              label="App instances"
              value={`${health.instances.filter((instance) => instance.status === "online").length}/${health.instances.length}`}
              caption="private Compose services"
            />
            <MetricTile
              icon={<Database size={17} />}
              label="Storage"
              value={health.components.find((component) => component.name === "PostgreSQL")?.status ?? "unknown"}
              caption="Postgres and pgvector"
            />
            <MetricTile
              icon={<Activity size={17} />}
              label="Models"
              value={health.models.llmApiStyle}
              caption={health.models.embedding}
            />
          </div>

          <section className="health-section">
            <div className="panel-heading">
              <ShieldCheck size={19} />
              <h2>Components</h2>
            </div>
            <div className="health-card-grid">
              {health.components.map((component) => (
                <article className="health-card" key={component.name}>
                  <div>
                    <strong>{component.name}</strong>
                    <StatusBadge tone={healthTone(component.status)}>{component.status}</StatusBadge>
                  </div>
                  <p>{component.details}</p>
                  <span>{component.checkedAt}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="health-section">
            <div className="panel-heading">
              <Server size={19} />
              <h2>Application Instances</h2>
            </div>
            <div className="health-card-grid">
              {health.instances.map((instance) => (
                <article className="health-card" key={`${instance.name}-${instance.url}`}>
                  <div>
                    <strong>{instance.name}</strong>
                    <StatusBadge tone={instance.status === "online" ? "success" : "danger"}>
                      {instance.status}
                    </StatusBadge>
                  </div>
                  <p>{instance.url}</p>
                  <dl className="health-details">
                    {instance.hostname && (
                      <>
                        <dt>Host</dt>
                        <dd>{instance.hostname}</dd>
                      </>
                    )}
                    {typeof instance.pid === "number" && (
                      <>
                        <dt>PID</dt>
                        <dd>{instance.pid}</dd>
                      </>
                    )}
                    {typeof instance.uptimeSeconds === "number" && (
                      <>
                        <dt>Uptime</dt>
                        <dd>{instance.uptimeSeconds}s</dd>
                      </>
                    )}
                    {instance.error && (
                      <>
                        <dt>Error</dt>
                        <dd>{instance.error}</dd>
                      </>
                    )}
                  </dl>
                  <span>{instance.checkedAt}</span>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : (
        <div className="empty-state compact-empty">
          <div className="empty-mark">
            {status === "loading" ? <Loader2 className="spin" size={34} /> : <Server size={34} />}
          </div>
          <h2>{status === "loading" ? "Checking system" : "No health data loaded"}</h2>
          <p>Refresh to check storage, providers, and application instances.</p>
        </div>
      )}
    </section>
  </div>
);

export const App = () => {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [jobPostings, setJobPostings] = useState<JobPostingRecord[]>([]);
  const [jobSearchResults, setJobSearchResults] = useState<JobPostingRecord[]>([]);
  const [jobSearch, setJobSearch] = useState("");
  const [jobSearchStatus, setJobSearchStatus] = useState<Status>("idle");
  const [jobSearchError, setJobSearchError] = useState("");
  const [applicationSearch, setApplicationSearch] = useState("");
  const [applicationSearchResults, setApplicationSearchResults] = useState<JobRecord[]>([]);
  const [applicationSearchStatus, setApplicationSearchStatus] = useState<Status>("idle");
  const [applicationSearchError, setApplicationSearchError] = useState("");
  const [selectedPostingApplicationsId, setSelectedPostingApplicationsId] = useState<number | null>(null);
  const [selectedPostingApplications, setSelectedPostingApplications] = useState<JobRecord[]>([]);
  const [selectedPostingApplicationsStatus, setSelectedPostingApplicationsStatus] = useState<Status>("idle");
  const [selectedPostingApplicationsError, setSelectedPostingApplicationsError] = useState("");
  const [token, setToken] = useState(() => localStorage.getItem(authStorageKey) || "");
  const [user, setUser] = useState<UserRecord | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [loginEmail, setLoginEmail] = useState("admin@example.com");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginStatus, setLoginStatus] = useState<Status>("idle");
  const [loginError, setLoginError] = useState("");
  const [adminOverview, setAdminOverview] = useState<AdminOverviewResponse | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUserDetailRecord[]>([]);
  const [adminUsersSearch, setAdminUsersSearch] = useState("");
  const [adminUsersStatus, setAdminUsersStatus] = useState<Status>("idle");
  const [adminUsersError, setAdminUsersError] = useState("");
  const [systemHealth, setSystemHealth] = useState<SystemHealthResponse | null>(null);
  const [systemHealthStatus, setSystemHealthStatus] = useState<Status>("idle");
  const [systemHealthError, setSystemHealthError] = useState("");
  const [activeView, setActiveView] = useState<ActiveView>(() => viewFromPath(window.location.pathname));
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileNotice, setProfileNotice] = useState("");
  const [profileStatus, setProfileStatus] = useState<Status>("idle");
  const [profileError, setProfileError] = useState("");
  const [resumeVersions, setResumeVersions] = useState<ResumeVersionRecord[]>([]);
  const [resumeUploadFile, setResumeUploadFile] = useState<File | null>(null);
  const [resumeUploadPrivacy, setResumeUploadPrivacy] = useState<PrivacyRedactionForm>(() => defaultPrivacyRedactionForm());
  const [resumeUploadPrivacyStatus, setResumeUploadPrivacyStatus] = useState<Status>("idle");
  const [resumeUploadPrivacyError, setResumeUploadPrivacyError] = useState("");
  const [resumeUploadInputKey, setResumeUploadInputKey] = useState(0);
  const [resumeUploadStatus, setResumeUploadStatus] = useState<Status>("idle");
  const [resumeUploadError, setResumeUploadError] = useState("");
  const [resumeUploadRedactionTotal, setResumeUploadRedactionTotal] = useState<number | null>(null);
  const [registrationName, setRegistrationName] = useState("");
  const [registrationEmail, setRegistrationEmail] = useState("");
  const [registrationPassword, setRegistrationPassword] = useState("");
  const [registrationPasswordConfirmation, setRegistrationPasswordConfirmation] = useState("");
  const [showRegistrationPassword, setShowRegistrationPassword] = useState(false);
  const [showRegistrationPasswordConfirmation, setShowRegistrationPasswordConfirmation] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState<Status>("idle");
  const [registrationError, setRegistrationError] = useState("");
  const [registeredUser, setRegisteredUser] = useState<UserRecord | null>(null);
  const [newPostingTitle, setNewPostingTitle] = useState("");
  const [newPostingDescription, setNewPostingDescription] = useState("");
  const [newPostingSkill, setNewPostingSkill] = useState("");
  const [newPostingSkills, setNewPostingSkills] = useState<string[]>([]);
  const [postingStatus, setPostingStatus] = useState<Status>("idle");
  const [postingError, setPostingError] = useState("");
  const resumeUploadFormRef = useRef<HTMLFormElement | null>(null);

  const authHeaders = (activeToken = token) => ({
    Authorization: `Bearer ${activeToken}`
  });

  const registrationPasswordChecks = {
    length: registrationPassword.length >= 12,
    lowercase: /[a-z]/.test(registrationPassword),
    uppercase: /[A-Z]/.test(registrationPassword),
    number: /[0-9]/.test(registrationPassword)
  };
  const registrationPasswordValid = Object.values(registrationPasswordChecks).every(Boolean);
  const registrationPasswordsMatch =
    registrationPasswordConfirmation.length > 0 && registrationPassword === registrationPasswordConfirmation;
  const hasProfileResume = resumeVersions.length > 0;

  const navigateToView = (view: ActiveView, options: { replace?: boolean } = {}) => {
    setActiveView(view);
    const nextPath = routeForView[view];
    if (window.location.pathname !== nextPath) {
      const method = options.replace ? "replaceState" : "pushState";
      window.history[method]({}, "", nextPath);
    }
  };

  const persistSession = (nextUser: UserRecord, nextToken: string) => {
    localStorage.setItem(authStorageKey, nextToken);
    setToken(nextToken);
    setUser(nextUser);
    setProfileName(nextUser.name);
    setProfileEmail(nextUser.email);
    setResumeUploadPrivacy(defaultPrivacyRedactionForm(nextUser));
    const nextView = adminOnlyViews.has(activeView) && nextUser.role !== "admin"
      ? defaultAuthenticatedView
      : activeView;
    navigateToView(nextView, { replace: window.location.pathname !== routeForView[nextView] });
  };

  const clearSession = () => {
    localStorage.removeItem(authStorageKey);
    setToken("");
    setUser(null);
    setJobs([]);
    setJobPostings([]);
    setJobSearchResults([]);
    setJobSearch("");
    setJobSearchStatus("idle");
    setJobSearchError("");
    setApplicationSearch("");
    setApplicationSearchResults([]);
    setApplicationSearchStatus("idle");
    setApplicationSearchError("");
    setSelectedPostingApplicationsId(null);
    setSelectedPostingApplications([]);
    setSelectedPostingApplicationsStatus("idle");
    setSelectedPostingApplicationsError("");
    setAdminOverview(null);
    setAdminUsers([]);
    setAdminUsersSearch("");
    setAdminUsersStatus("idle");
    setAdminUsersError("");
    setSystemHealth(null);
    setSystemHealthStatus("idle");
    setSystemHealthError("");
    setResult(null);
    navigateToView(defaultAuthenticatedView, { replace: true });
    setProfileName("");
    setProfileEmail("");
    setResumeUploadPrivacy(defaultPrivacyRedactionForm());
    setResumeUploadPrivacyStatus("idle");
    setResumeUploadPrivacyError("");
    setResumeVersions([]);
    setResumeUploadRedactionTotal(null);
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

  const loadAdminUsers = async (activeToken = token, search = adminUsersSearch) => {
    if (!activeToken) {
      setAdminUsers([]);
      return;
    }

    setAdminUsersError("");
    setAdminUsersStatus("loading");
    try {
      const params = new URLSearchParams();
      const trimmedSearch = search.trim();
      if (trimmedSearch) {
        params.set("search", trimmedSearch);
      }

      const response = await fetch(`/api/admin/users${params.size ? `?${params.toString()}` : ""}`, {
        headers: authHeaders(activeToken)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "User search failed.");
      }

      setAdminUsers((data as AdminUsersResponse).users);
      setAdminUsersStatus("success");
    } catch (caught) {
      setAdminUsersStatus("error");
      setAdminUsersError(caught instanceof Error ? caught.message : "User search failed.");
    }
  };

  const loadSystemHealth = async (activeToken = token) => {
    if (!activeToken) {
      setSystemHealth(null);
      return;
    }

    setSystemHealthError("");
    setSystemHealthStatus("loading");
    try {
      const response = await fetch("/api/admin/system-health", {
        headers: authHeaders(activeToken)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "System health check failed.");
      }

      setSystemHealth(data as SystemHealthResponse);
      setSystemHealthStatus("success");
    } catch (caught) {
      setSystemHealthStatus("error");
      setSystemHealthError(caught instanceof Error ? caught.message : "System health check failed.");
    }
  };

  const loadJobPostings = async (activeToken = token) => {
    if (!activeToken) {
      setJobPostings([]);
      setJobSearchResults([]);
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
    if (!jobSearch.trim()) {
      setJobSearchResults(data.jobPostings);
    }
  };

  const loadJobSearch = async (activeToken = token, search = jobSearch) => {
    if (!activeToken) {
      setJobSearchResults([]);
      return;
    }

    setJobSearchError("");
    setJobSearchStatus("loading");
    try {
      const params = new URLSearchParams();
      const trimmedSearch = search.trim();
      if (trimmedSearch) {
        params.set("search", trimmedSearch);
      }

      const response = await fetch(`/api/job-postings${params.size ? `?${params.toString()}` : ""}`, {
        headers: authHeaders(activeToken)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Job search failed.");
      }

      setJobSearchResults((data as JobPostingsResponse).jobPostings);
      setJobSearchStatus("success");
    } catch (caught) {
      setJobSearchStatus("error");
      setJobSearchError(caught instanceof Error ? caught.message : "Job search failed.");
    }
  };

  const loadApplicationSearch = async (activeToken = token, search = applicationSearch) => {
    if (!activeToken) {
      setApplicationSearchResults([]);
      return;
    }

    setApplicationSearchError("");
    setApplicationSearchStatus("loading");
    try {
      const params = new URLSearchParams();
      const trimmedSearch = search.trim();
      if (trimmedSearch) {
        params.set("search", trimmedSearch);
      }

      const response = await fetch(`/api/applications${params.size ? `?${params.toString()}` : ""}`, {
        headers: authHeaders(activeToken)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Application search failed.");
      }

      setApplicationSearchResults((data as JobsResponse).jobs);
      setApplicationSearchStatus("success");
    } catch (caught) {
      setApplicationSearchStatus("error");
      setApplicationSearchError(caught instanceof Error ? caught.message : "Application search failed.");
    }
  };

  const loadPostingApplications = async (posting: JobPostingRecord, activeToken = token) => {
    if (!activeToken) {
      setSelectedPostingApplications([]);
      return;
    }

    setSelectedPostingApplicationsId(posting.id);
    setSelectedPostingApplicationsError("");
    setSelectedPostingApplicationsStatus("loading");
    try {
      const response = await fetch(`/api/admin/job-postings/${posting.id}/applications`, {
        headers: authHeaders(activeToken)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Applications failed to load.");
      }

      setSelectedPostingApplications((data as JobPostingApplicationsResponse).jobs);
      setSelectedPostingApplicationsStatus("success");
    } catch (caught) {
      setSelectedPostingApplicationsStatus("error");
      setSelectedPostingApplicationsError(caught instanceof Error ? caught.message : "Applications failed to load.");
    }
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
    setResumeUploadPrivacy(defaultPrivacyRedactionForm(data.user));
    setResumeVersions(data.resumes);
  };

  const previewResumePrivacy = async ({
    resumeFile,
    fallback,
    onApply,
    onStatus,
    onError,
    activeToken = token
  }: {
    resumeFile: File;
    fallback: PrivacyRedactionForm;
    onApply: (value: PrivacyRedactionForm) => void;
    onStatus: (status: Status) => void;
    onError: (message: string) => void;
    activeToken?: string;
  }) => {
    if (!activeToken) {
      return;
    }

    const payload = new FormData();
    payload.set("resume", resumeFile);
    onStatus("loading");
    onError("");

    try {
      const response = await fetch("/api/resumes/privacy-preview", {
        method: "POST",
        headers: authHeaders(activeToken),
        body: payload
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Privacy scan failed.");
      }

      onApply(privacyPreviewToForm(data as PrivacyPreviewResponse, fallback));
      onStatus("success");
    } catch (caught) {
      onStatus("error");
      onError(caught instanceof Error ? caught.message : "Privacy scan failed.");
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      setActiveView(viewFromPath(window.location.pathname));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
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
        await loadAdminUsers(token, "");
      }
    };

    void loadSession();
  }, []);

  useEffect(() => {
    if (!user || user.role === "admin" || !adminOnlyViews.has(activeView)) {
      return;
    }

    navigateToView(defaultAuthenticatedView, { replace: true });
  }, [activeView, user?.role]);

  useEffect(() => {
    if (activeView !== "profile" || !profileNotice) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      resumeUploadFormRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
      const input = resumeUploadFormRef.current?.querySelector<HTMLInputElement>('input[type="file"]');
      input?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeView, profileNotice]);

  useEffect(() => {
    if (!token || user?.role !== "admin" || activeView !== "adminUsers") {
      return;
    }

    const timeout = window.setTimeout(() => {
      void loadAdminUsers(token, adminUsersSearch);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [activeView, adminUsersSearch, token, user?.role]);

  useEffect(() => {
    if (!token || activeView !== "jobs") {
      return;
    }

    const timeout = window.setTimeout(() => {
      void loadJobSearch(token, jobSearch);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [activeView, jobSearch, token]);

  useEffect(() => {
    if (!token || activeView !== "applications") {
      return;
    }

    const timeout = window.setTimeout(() => {
      void loadApplicationSearch(token, applicationSearch);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [activeView, applicationSearch, token]);

  useEffect(() => {
    if (!token || user?.role !== "admin" || activeView !== "systemHealth") {
      return;
    }

    void loadSystemHealth();
  }, [activeView, token, user?.role]);

  const resumeUploadLabel = useMemo(() => {
    if (!resumeUploadFile) {
      return "Upload a new resume version";
    }

    return `${resumeUploadFile.name} (${Math.ceil(resumeUploadFile.size / 1024)} KB)`;
  }, [resumeUploadFile]);

  const selectResumeUploadFile = (selectedFile: File | null) => {
    setResumeUploadFile(selectedFile);
    const fallback = defaultPrivacyRedactionForm(user);
    setResumeUploadPrivacy(fallback);
    setResumeUploadPrivacyStatus("idle");
    setResumeUploadPrivacyError("");

    if (selectedFile) {
      void previewResumePrivacy({
        resumeFile: selectedFile,
        fallback,
        onApply: setResumeUploadPrivacy,
        onStatus: setResumeUploadPrivacyStatus,
        onError: setResumeUploadPrivacyError
      });
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
        await loadAdminUsers(session.token, "");
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
      if (!registrationPasswordValid) {
        throw new Error("Password must meet all listed rules.");
      }
      if (!registrationPasswordsMatch) {
        throw new Error("Retyped password must match.");
      }

      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: registrationName,
          email: registrationEmail,
          password: registrationPassword,
          passwordConfirmation: registrationPasswordConfirmation
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
      setRegistrationPasswordConfirmation("");
      await loadJobs(registered.token);
      await loadJobPostings(registered.token);
      await loadProfile(registered.token);
    } catch (caught) {
      setRegistrationStatus("error");
      setRegistrationError(caught instanceof Error ? caught.message : "Registration failed.");
    }
  };

  const openProfile = async () => {
    navigateToView("profile");
    await loadProfile();
  };

  const openAdminUsers = async () => {
    navigateToView("adminUsers");
    await loadAdminUsers();
  };

  const openJobs = async () => {
    navigateToView("jobs");
    await loadJobSearch();
  };

  const openApplications = async () => {
    navigateToView("applications");
    await loadApplicationSearch();
  };

  const openSystemHealth = async () => {
    navigateToView("systemHealth");
    await loadSystemHealth();
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
      setResumeUploadPrivacy(defaultPrivacyRedactionForm(updated.user));
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
    payload.set("privacyRedactions", JSON.stringify(serializePrivacyRedactions(resumeUploadPrivacy)));
    setResumeUploadStatus("loading");
    setResumeUploadRedactionTotal(null);

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
      setResumeUploadPrivacy(defaultPrivacyRedactionForm(user));
      setResumeUploadPrivacyStatus("idle");
      setResumeUploadPrivacyError("");
      setResumeUploadRedactionTotal(uploaded.privacyRedaction.total);
      setResumeUploadInputKey((current) => current + 1);
      setResumeUploadStatus("success");
      setProfileNotice("");
    } catch (caught) {
      setResumeUploadStatus("error");
      setResumeUploadError(caught instanceof Error ? caught.message : "Resume upload failed.");
    }
  };

  const downloadResume = async (resume: ResumeVersionRecord) => {
    setResumeUploadError("");
    setAdminUsersError("");

    try {
      const response = await fetch(`/api/resumes/${resume.id}/download`, {
        headers: authHeaders()
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Resume download failed.");
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filenameFromContentDisposition(
        response.headers.get("content-disposition"),
        resume.fileName
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Resume download failed.";
      if (activeView === "adminUsers") {
        setAdminUsersError(message);
        setAdminUsersStatus("error");
      } else {
        setResumeUploadError(message);
        setResumeUploadStatus("error");
      }
    }
  };

  const matchLatestResumeToPosting = async (posting: JobPostingRecord) => {
    setError("");
    setResult(null);

    if (!token || !user) {
      setStatus("error");
      setError("Sign in before matching a role.");
      navigateToView("analysis");
      return;
    }

    if (!hasProfileResume) {
      setProfileNotice(`Upload a resume before ${user.role === "admin" ? "analyzing candidates" : `applying to ${posting.title}`}.`);
      setResumeUploadStatus("idle");
      setResumeUploadError("");
      navigateToView("profile");
      void loadProfile();
      return;
    }

    const nextApplicationDate = today();
    setStatus("loading");
    navigateToView("analysis");

    try {
      const response = await fetch("/api/analyze/latest", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          jobPostingId: posting.id,
          applicationDate: nextApplicationDate
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed.");
      }

      setResult(data as AnalyzeResponse);
      setStatus("success");
      void loadJobs();
      void loadApplicationSearch();
      void loadJobPostings();
      if (user.role === "admin") {
        void loadAdminOverview();
        void loadAdminUsers();
      }
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Analysis failed.");
    }
  };

  const downloadAssessment = async (job: JobRecord) => {
    setAdminUsersError("");
    setProfileError("");
    setError("");

    try {
      const response = await fetch(`/api/admin/jobs/${job.id}/assessment.pdf`, {
        headers: authHeaders()
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Assessment download failed.");
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filenameFromContentDisposition(
        response.headers.get("content-disposition"),
        `assessment-${job.id}.pdf`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Assessment download failed.";
      if (activeView === "adminUsers") {
        setAdminUsersError(message);
        setAdminUsersStatus("error");
      } else if (activeView === "profile") {
        setProfileError(message);
        setProfileStatus("error");
      } else {
        setError(message);
        setStatus("error");
      }
    }
  };

  const replaceJobInState = (updatedJob: JobRecord) => {
    const replace = (job: JobRecord) => (job.id === updatedJob.id ? updatedJob : job);

    setJobs((current) => current.map(replace));
    setApplicationSearchResults((current) => current.map(replace));
    setSelectedPostingApplications((current) => current.map(replace));
    setAdminOverview((current) => current
      ? {
          ...current,
          jobs: current.jobs.map(replace)
        }
      : current);
    setAdminUsers((current) => current.map((adminUser) => ({
      ...adminUser,
      recentApplications: adminUser.recentApplications.map(replace)
    })));
    setResult((current) => {
      if (!current || current.job.id !== updatedJob.id || !updatedJob.analysis) {
        return current;
      }

      return {
        ...current,
        job: updatedJob,
        analysis: updatedJob.analysis
      };
    });
  };

  const saveInterviewQuestions = async (job: JobRecord, interviewQuestions: string[]) => {
    const response = await fetch(`/api/admin/jobs/${job.id}/interview-questions`, {
      method: "PATCH",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ interviewQuestions })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Interview question update failed.");
    }

    replaceJobInState((data as { job: JobRecord }).job);
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
      if (!jobSearch.trim()) {
        setJobSearchResults((current) => [created.jobPosting, ...current]);
      }
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

    if (activePosting) {
      void matchLatestResumeToPosting(activePosting);
      return;
    }

    setJobSearch(job.jobTitle);
    navigateToView("jobs");
    void loadJobSearch(token, job.jobTitle);
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
                  <div className="input-with-icon has-action">
                    <LockKeyhole size={18} />
                    <input
                      autoComplete="new-password"
                      type={showRegistrationPassword ? "text" : "password"}
                      value={registrationPassword}
                      onChange={(event) => setRegistrationPassword(event.target.value)}
                      placeholder="12+ chars, mixed case, number"
                    />
                    <button
                      aria-label={showRegistrationPassword ? "Hide password" : "Show password"}
                      className="input-icon-button"
                      type="button"
                      onClick={() => setShowRegistrationPassword((current) => !current)}
                    >
                      {showRegistrationPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </label>

                <label className="field">
                  <span>Retype password</span>
                  <div className="input-with-icon has-action">
                    <LockKeyhole size={18} />
                    <input
                      autoComplete="new-password"
                      type={showRegistrationPasswordConfirmation ? "text" : "password"}
                      value={registrationPasswordConfirmation}
                      onChange={(event) => setRegistrationPasswordConfirmation(event.target.value)}
                      placeholder="Retype account password"
                    />
                    <button
                      aria-label={showRegistrationPasswordConfirmation ? "Hide retyped password" : "Show retyped password"}
                      className="input-icon-button"
                      type="button"
                      onClick={() => setShowRegistrationPasswordConfirmation((current) => !current)}
                    >
                      {showRegistrationPasswordConfirmation ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </label>

                <div className="password-rules" aria-live="polite">
                  {Object.entries(passwordRuleLabels).map(([rule, label]) => {
                    const satisfied = registrationPasswordChecks[rule as keyof typeof registrationPasswordChecks];
                    return (
                      <span className={satisfied ? "satisfied" : ""} key={rule}>
                        {satisfied ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                        {label}
                      </span>
                    );
                  })}
                  <span className={registrationPasswordsMatch ? "satisfied" : ""}>
                    {registrationPasswordsMatch ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                    Passwords match
                  </span>
                </div>

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
          <button className={`nav-button${activeView === "applications" ? " active" : ""}`} type="button" onClick={openApplications}>
            <Database size={16} />
            Applications
          </button>
          <button className={`nav-button${activeView === "jobs" ? " active" : ""}`} type="button" onClick={openJobs}>
            <SearchCheck size={16} />
            Jobs
          </button>
          {user.role === "admin" && (
            <>
              <button className={`nav-button${activeView === "adminUsers" ? " active" : ""}`} type="button" onClick={openAdminUsers}>
                <UsersRound size={16} />
                Users
              </button>
              <button className={`nav-button${activeView === "systemHealth" ? " active" : ""}`} type="button" onClick={openSystemHealth}>
                <Server size={16} />
                Health
              </button>
              <button className={`nav-button primary-nav${activeView === "adminJobs" ? " active" : ""}`} type="button" onClick={() => navigateToView("adminJobs")}>
                <BriefcaseBusiness size={16} />
                Add jobs
              </button>
            </>
          )}
          <button className={`nav-button${activeView === "profile" ? " active" : ""}`} type="button" onClick={openProfile}>
            <UserRound size={16} />
            Profile
          </button>
          <button className="nav-button" type="button" onClick={logout}>
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </header>

      <section className="workspace">
        <section className="results-column">
          {activeView === "applications" && (
            <ApplicationSearchPanel
              jobs={applicationSearchResults}
              search={applicationSearch}
              status={applicationSearchStatus}
              error={applicationSearchError}
              isAdmin={user.role === "admin"}
              onSearchChange={setApplicationSearch}
              onRefresh={() => void loadApplicationSearch()}
              onUseJob={useJobForNewAnalysis}
              onDownloadAssessment={(job) => void downloadAssessment(job)}
              onSaveInterviewQuestions={(job, questions) => saveInterviewQuestions(job, questions)}
            />
          )}

          {activeView === "jobs" && (
            <JobSearchPanel
              postings={jobSearchResults}
              search={jobSearch}
              status={jobSearchStatus}
              error={jobSearchError}
              selectedPostingId={selectedPostingApplicationsId}
              selectedPostingApplications={selectedPostingApplications}
              selectedPostingApplicationsStatus={selectedPostingApplicationsStatus}
              selectedPostingApplicationsError={selectedPostingApplicationsError}
              onSearchChange={setJobSearch}
              onRefresh={() => void loadJobSearch()}
              onUsePosting={(posting) => void matchLatestResumeToPosting(posting)}
              onViewApplications={user.role === "admin" ? (posting) => void loadPostingApplications(posting) : undefined}
              onDownloadAssessment={(job) => void downloadAssessment(job)}
              onSaveInterviewQuestions={(job, questions) => saveInterviewQuestions(job, questions)}
              isAdmin={user.role === "admin"}
              hasResume={hasProfileResume}
            />
          )}

          {activeView === "adminUsers" && user.role === "admin" && (
            <AdminUsersPanel
              users={adminUsers}
              search={adminUsersSearch}
              status={adminUsersStatus}
              error={adminUsersError}
              onSearchChange={setAdminUsersSearch}
              onRefresh={() => void loadAdminUsers()}
              onDownloadResume={(resume) => void downloadResume(resume)}
              onDownloadAssessment={(job) => void downloadAssessment(job)}
              onSaveInterviewQuestions={(job, questions) => saveInterviewQuestions(job, questions)}
            />
          )}

          {activeView === "systemHealth" && user.role === "admin" && (
            <SystemHealthPanel
              health={systemHealth}
              status={systemHealthStatus}
              error={systemHealthError}
              onRefresh={() => void loadSystemHealth()}
            />
          )}

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
                    placeholder="Veterinary Receptionist"
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
                            onClick={() => void matchLatestResumeToPosting(posting)}
                          >
                            <Target size={16} />
                            Analyze candidate
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
                {profileNotice && (
                  <div className="notice warning">
                    <AlertCircle size={18} />
                    <span>{profileNotice}</span>
                  </div>
                )}
                <form className="form-stack profile-form" ref={resumeUploadFormRef} onSubmit={uploadResumeVersion}>
                  <label className="upload-zone">
                    <div className="upload-icon">
                      <Upload size={22} />
                    </div>
                    <span>{resumeUploadLabel}</span>
                    <input
                      key={resumeUploadInputKey}
                      type="file"
                      accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                      onChange={(event) => selectResumeUploadFile(event.target.files?.[0] ?? null)}
                    />
                  </label>
                  {resumeUploadFile && (
                    <PrivacyReviewFields
                      value={resumeUploadPrivacy}
                      onChange={setResumeUploadPrivacy}
                      status={resumeUploadPrivacyStatus}
                      error={resumeUploadPrivacyError}
                    />
                  )}
                  <button className="secondary-button" disabled={resumeUploadStatus === "loading"} type="submit">
                    {resumeUploadStatus === "loading" ? <Loader2 className="spin" size={18} /> : <Upload size={18} />}
                    Upload new version
                  </button>
                </form>

                {resumeUploadStatus === "success" && (
                  <div className="notice success">
                    <CheckCircle2 size={18} />
                    <span>
                      Resume version saved without replacing previous versions.
                      {resumeUploadRedactionTotal !== null ? ` ${redactionTotalLabel(resumeUploadRedactionTotal)}.` : ""}
                    </span>
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
                        <div className="resume-version-actions">
                          <StatusBadge>{formatFileSize(resume.fileSize)}</StatusBadge>
                          <button
                            className="secondary-button compact-action"
                            type="button"
                            onClick={() => void downloadResume(resume)}
                          >
                            <Download size={16} />
                            Download
                          </button>
                        </div>
                        <p>{Math.ceil(resume.characterCount / 1000)}k chars | {resume.createdAt}</p>
                      </article>
                    ))
                  )}
                </div>
              </section>

              <ProfileApplications
                jobs={jobs}
                isAdmin={user.role === "admin"}
                onUseJob={useJobForNewAnalysis}
                onDownloadAssessment={(job) => void downloadAssessment(job)}
                onSaveInterviewQuestions={(job, questions) => saveInterviewQuestions(job, questions)}
              />
            </div>
          )}

          {activeView === "analysis" && status === "loading" && (
            <div className="empty-state">
              <div className="empty-mark">
                <Loader2 className="spin" size={34} />
              </div>
              <h2>Analyzing resume</h2>
              <p>Parsing, embedding, storing evidence, and generating a recommendation.</p>
            </div>
          )}

          {activeView === "analysis" && status === "error" && (
            <div className="empty-state">
              <div className="empty-mark">
                <AlertCircle size={34} />
              </div>
              <h2>Analysis did not complete</h2>
              <p>{error || "Review the resume and job details, then try again."}</p>
            </div>
          )}

          {activeView === "analysis" && result && (
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
                    {redactionTotalLabel(result.privacyRedaction.total)} |{" "}
                    {result.models.embedding}
                  </span>
                  {user.role === "admin" && (
                    <button
                      className="secondary-button compact-action assessment-download"
                      type="button"
                      onClick={() => void downloadAssessment(result.job)}
                    >
                      <Download size={16} />
                      Download assessment
                    </button>
                  )}
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

              <HREvaluationDetails analysis={result.analysis} />

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
              {user.role === "admin" && (
                <InterviewQuestionsEditor
                  questions={result.analysis.interviewQuestions}
                  onSave={(questions) => saveInterviewQuestions(result.job, questions)}
                />
              )}

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
