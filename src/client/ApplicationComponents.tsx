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
  FilePenLine,
  FileText,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  Layers3,
  Loader2,
  Palette,
  Search,
  SearchCheck,
  Server,
  ShieldCheck,
  Sparkles,
  Tag,
  Target,
  Upload,
  UserPlus,
  UserRound,
  UsersRound,
  XCircle
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { JobRecord, RequirementAssessment, ResumeAnalysis } from "../shared/types";
import {
  InfiniteListFooter,
  JobFitBadge,
  JobKindBadge,
  StatusBadge
} from "./CommonComponents";
import type { Status } from "./appTypes";
import { evidenceRelevanceLabel } from "./appUtils";

export const ApplicationMeta = ({
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

export const ApplicationAnalysisList = ({
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

export const InterviewQuestionsEditor = ({
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
  const pendingSavedDraftRef = useRef<string | null>(null);

  useEffect(() => {
    const nextDraft = questions.join("\n");
    setDraft(nextDraft);
    setStatus(() => {
      if (pendingSavedDraftRef.current === nextDraft) {
        pendingSavedDraftRef.current = null;
        return "success";
      }

      return "idle";
    });
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
      pendingSavedDraftRef.current = nextQuestions.join("\n");
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

export const scoreBreakdownEntries = (analysis: ResumeAnalysis) => {
  return [
    ["Minimum qualifications", analysis.scoreBreakdown.minimumQualifications],
    ["Role competencies", analysis.scoreBreakdown.roleCompetencies],
    ["Domain experience", analysis.scoreBreakdown.domainExperience],
    ["Preferred qualifications", analysis.scoreBreakdown.preferredQualifications],
    ["Seniority and scope", analysis.scoreBreakdown.seniorityScope],
    ["Evidence quality", analysis.scoreBreakdown.evidenceQuality]
  ] as const;
};

export const requirementCategoryLabel = (category: RequirementAssessment["category"]) => {
  const labels: Record<RequirementAssessment["category"], string> = {
    minimum: "Minimum qualification",
    role_competency: "Role competency",
    domain: "Domain experience",
    preferred: "Preferred",
    seniority: "Seniority/scope"
  };

  return labels[category];
};

export const requirementImportanceLabel = (importance: RequirementAssessment["importance"]) => {
  const labels: Record<RequirementAssessment["importance"], string> = {
    must_have: "Must-have",
    preferred: "Preferred"
  };

  return labels[importance];
};

export const requirementStatusLabel = (status: RequirementAssessment["status"]) => {
  const labels: Record<RequirementAssessment["status"], string> = {
    met: "Met",
    partially_met: "Partially met",
    not_evidenced: "Not evidenced"
  };

  return labels[status];
};

export const requirementStatusTone = (status: RequirementAssessment["status"]) => {
  const tones: Record<RequirementAssessment["status"], "met" | "partial" | "missing"> = {
    met: "met",
    partially_met: "partial",
    not_evidenced: "missing"
  };

  return tones[status];
};

export const HREvaluationDetails = ({
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

export const ApplicationAnalysisDetails = ({
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

export const ApplicationDetailsBody = ({
  job,
  isAdmin,
  onUseJob,
  onDownloadAssessment,
  onConvertToApplication,
  onScheduleMeeting,
  onSaveInterviewQuestions
}: {
  job: JobRecord;
  isAdmin: boolean;
  onUseJob?: (job: JobRecord) => void;
  onDownloadAssessment?: (job: JobRecord) => void;
  onConvertToApplication?: (job: JobRecord) => Promise<void> | void;
  onScheduleMeeting?: (job: JobRecord) => void;
  onSaveInterviewQuestions?: (job: JobRecord, questions: string[]) => Promise<void> | void;
}) => (
  <div className="application-details">
    <div className="application-meta-grid">
      <ApplicationMeta label="Posting" value={job.jobPostingTitle} />
      <ApplicationMeta label="Resume" value={job.resumeFileName} />
      <ApplicationMeta label="Resume size" value={job.characterCount ? `${job.characterCount} chars` : undefined} />
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

    {(onUseJob || (onDownloadAssessment && job.analysis) || onScheduleMeeting || (onConvertToApplication && job.analysisKind === "candidate_assessment")) && (
      <div className="application-actions">
        {onUseJob && (
          <button className={isAdmin ? "assess-candidate-button application-action" : "secondary-button application-action"} type="button" onClick={() => onUseJob(job)}>
            <Target size={16} />
            {isAdmin ? "Assess a candidate" : "Use for new analysis"}
          </button>
        )}
        {onDownloadAssessment && job.analysis && (
          <button
            className="assessment-toolbar-button application-action"
            type="button"
            onClick={() => onDownloadAssessment(job)}
          >
            <Download size={16} />
            Download assessment
          </button>
        )}
        {onScheduleMeeting && (
          <button
            className="assessment-toolbar-button application-action"
            type="button"
            onClick={() => onScheduleMeeting(job)}
          >
            <Clock3 size={16} />
            Schedule meeting
          </button>
        )}
        {onConvertToApplication && job.analysisKind === "candidate_assessment" && (
          <button
            className="convert-application-button application-action"
            type="button"
            onClick={() => onConvertToApplication(job)}
          >
            <CheckCircle2 size={16} />
            Convert to application
          </button>
        )}
      </div>
    )}
  </div>
);

export const ProfileApplications = ({
  jobs,
  status,
  hasMore,
  isAdmin,
  onUseJob,
  onLoadMore,
  onDownloadAssessment,
  onConvertToApplication,
  onScheduleMeeting,
  onSaveInterviewQuestions
}: {
  jobs: JobRecord[];
  status: Status;
  hasMore: boolean;
  isAdmin: boolean;
  onUseJob: (job: JobRecord) => void;
  onLoadMore: () => void;
  onDownloadAssessment?: (job: JobRecord) => void;
  onConvertToApplication?: (job: JobRecord) => Promise<void> | void;
  onScheduleMeeting?: (job: JobRecord) => void;
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
                  <span className="application-summary-badges">
                    {isAdmin && <JobKindBadge job={job} />}
                    <JobFitBadge job={job} />
                  </span>
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
                    onConvertToApplication={isAdmin ? onConvertToApplication : undefined}
                    onScheduleMeeting={isAdmin ? onScheduleMeeting : undefined}
                    onSaveInterviewQuestions={isAdmin ? onSaveInterviewQuestions : undefined}
                  />
                )}
              </article>
            );
          })}
          <InfiniteListFooter
            status={status}
            hasMore={hasMore}
            itemCount={jobs.length}
            loadingLabel="Loading applications"
            onLoadMore={onLoadMore}
          />
        </div>
      )}
    </section>
  );
};
