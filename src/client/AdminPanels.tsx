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
  Settings as SettingsIcon,
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
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type {
  AdminUserDetailRecord,
  AdminOverviewResponse,
  JobRecord,
  JobPostingRecord,
  PublicAppSettings,
  ResumeVersionRecord,
  SystemHealthResponse
} from "../shared/types";
import { ApplicationDetailsBody } from "./ApplicationComponents";
import {
  InfiniteListFooter,
  JobFitBadge,
  JobKindBadge,
  MetricTile,
  StatusBadge
} from "./CommonComponents";
import type { Status } from "./appTypes";
import { formatFileSize } from "./appUtils";
import { focusableModalElements } from "./modalFocus";

export const AdminUsersPanel = ({
  users,
  search,
  status,
  error,
  hasMore,
  onSearchChange,
  onRefresh,
  onLoadMore,
  onDownloadResume,
  onDownloadAssessment,
  onScheduleMeeting,
  onSaveInterviewQuestions
}: {
  users: AdminUserDetailRecord[];
  search: string;
  status: Status;
  error: string;
  hasMore: boolean;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  onDownloadResume: (resume: ResumeVersionRecord) => void;
  onDownloadAssessment: (job: JobRecord) => void;
  onScheduleMeeting: (job: JobRecord) => void;
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
                                  onScheduleMeeting={onScheduleMeeting}
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
          <InfiniteListFooter
            status={status}
            hasMore={hasMore}
            itemCount={users.length}
            loadingLabel="Loading users"
            onLoadMore={onLoadMore}
          />
        </div>
      </section>
    </section>
  );
};

export const PostingApplicationsPanel = ({
  posting,
  jobs,
  status,
  error,
  hasMore,
  panelRef,
  onLoadMore,
  onDownloadAssessment,
  onConvertToApplication,
  onScheduleMeeting,
  onSaveInterviewQuestions,
  embedded = false
}: {
  posting?: JobPostingRecord;
  jobs: JobRecord[];
  status: Status;
  error: string;
  hasMore: boolean;
  panelRef?: React.Ref<HTMLElement>;
  onLoadMore: () => void;
  onDownloadAssessment?: (job: JobRecord) => void;
  onConvertToApplication?: (job: JobRecord) => Promise<void> | void;
  onScheduleMeeting?: (job: JobRecord) => void;
  onSaveInterviewQuestions?: (job: JobRecord, questions: string[]) => Promise<void> | void;
  embedded?: boolean;
}) => {
  const [expandedJobId, setExpandedJobId] = useState<number | null>(jobs[0]?.id ?? null);

  useEffect(() => {
    setExpandedJobId((current) => current ?? jobs[0]?.id ?? null);
  }, [jobs]);

  if (!posting && status === "idle") {
    return null;
  }

  return (
    <section className={`${embedded ? "embedded-posting-applications-panel" : "surface-card full"} posting-applications-panel`} ref={panelRef}>
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

      {status === "loading" && jobs.length === 0 ? (
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
                  <span className="application-summary-badges">
                    <JobKindBadge job={job} />
                    <JobFitBadge job={job} />
                  </span>
                </button>

                {!expanded && job.llmRecommendation && (
                  <p className="application-preview">{job.llmRecommendation}</p>
                )}

                {expanded && (
	                  <ApplicationDetailsBody
	                    job={job}
	                    isAdmin
	                    onDownloadAssessment={onDownloadAssessment}
	                    onConvertToApplication={onConvertToApplication}
	                    onScheduleMeeting={onScheduleMeeting}
	                    onSaveInterviewQuestions={onSaveInterviewQuestions}
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

export const ApplicationSearchPanel = ({
  jobs,
  search,
  status,
  error,
  hasMore,
  isAdmin,
  onSearchChange,
  onRefresh,
  onLoadMore,
  onUseJob,
  onDownloadAssessment,
  onConvertToApplication,
  onScheduleMeeting,
  onSaveInterviewQuestions
}: {
  jobs: JobRecord[];
  search: string;
  status: Status;
  error: string;
  hasMore: boolean;
  isAdmin: boolean;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  onUseJob: (job: JobRecord) => void;
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

        {status === "loading" && jobs.length === 0 ? (
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
    </section>
  );
};

export const JobSearchPanel = ({
  postings,
  search,
  status,
  error,
  hasMore,
  selectedPostingId,
  selectedPostingApplications,
  selectedPostingApplicationsStatus,
  selectedPostingApplicationsError,
  selectedPostingApplicationsHasMore,
  onSearchChange,
  onRefresh,
  onLoadMore,
  onUsePosting,
  onViewApplications,
  onLoadMorePostingApplications,
  onDownloadAssessment,
  onConvertToApplication,
  onScheduleMeeting,
  onSaveInterviewQuestions,
  isAdmin,
  hasResume
}: {
  postings: JobPostingRecord[];
  search: string;
  status: Status;
  error: string;
  hasMore: boolean;
  selectedPostingId: number | null;
  selectedPostingApplications: JobRecord[];
  selectedPostingApplicationsStatus: Status;
  selectedPostingApplicationsError: string;
  selectedPostingApplicationsHasMore: boolean;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  onUsePosting: (posting: JobPostingRecord) => void;
  onViewApplications?: (posting: JobPostingRecord) => void;
  onLoadMorePostingApplications: () => void;
  onDownloadAssessment?: (job: JobRecord) => void;
  onConvertToApplication?: (job: JobRecord) => Promise<void> | void;
  onScheduleMeeting?: (job: JobRecord) => void;
  onSaveInterviewQuestions?: (job: JobRecord, questions: string[]) => Promise<void> | void;
  isAdmin: boolean;
  hasResume: boolean;
}) => {
  const applicationsPanelRef = useRef<HTMLElement | null>(null);

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
          postings.map((posting) => {
            const applicationCount = posting.matchCount ?? 0;
            return (
              <Fragment key={posting.id}>
                <article className="posting-card">
                  <div className="posting-card-header">
                    <div>
                      <strong>{posting.title}</strong>
                      <span>{posting.status} | {posting.createdAt}</span>
                    </div>
                    {onViewApplications && applicationCount > 0 ? (
                      <button
                        className={`status-badge application-count-button${selectedPostingId === posting.id ? " active" : ""}`}
                        type="button"
                        onClick={() => onViewApplications(posting)}
                      >
                        {applicationCount} applications
                      </button>
                    ) : (
                      <StatusBadge tone={posting.status === "active" ? "success" : "neutral"}>
                        {applicationCount} applications
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
                    <button className={isAdmin ? "assess-candidate-button" : "secondary-button"} type="button" onClick={() => onUsePosting(posting)}>
                      {isAdmin || hasResume ? <Target size={16} /> : <Upload size={16} />}
                      {isAdmin ? "Assess a candidate" : hasResume ? "Apply" : "Upload resume to apply"}
                    </button>
                  </div>
                </article>

                {selectedPostingId === posting.id && (
                  <PostingApplicationsPanel
                    posting={posting}
                    jobs={selectedPostingApplications}
                    status={selectedPostingApplicationsStatus}
                    error={selectedPostingApplicationsError}
                    hasMore={selectedPostingApplicationsHasMore}
                    panelRef={applicationsPanelRef}
                    onLoadMore={onLoadMorePostingApplications}
                    onDownloadAssessment={onDownloadAssessment}
                    onConvertToApplication={onConvertToApplication}
                    onScheduleMeeting={onScheduleMeeting}
                    onSaveInterviewQuestions={onSaveInterviewQuestions}
                    embedded
                  />
                )}
              </Fragment>
            );
          })
        )}
        <InfiniteListFooter
          status={status}
          hasMore={hasMore}
          itemCount={postings.length}
          loadingLabel="Loading roles"
          onLoadMore={onLoadMore}
        />
      </div>
    </section>
  </section>
  );
};

export const CandidatePickerModal = ({
  posting,
  candidates,
  search,
  status,
  error,
  analyzing,
  onSearchChange,
  onRefresh,
  onClose,
  onAnalyze
}: {
  posting: JobPostingRecord;
  candidates: AdminUserDetailRecord[];
  search: string;
  status: Status;
  error: string;
  analyzing: boolean;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onClose: () => void;
  onAnalyze: (candidate: AdminUserDetailRecord) => void;
}) => {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const modalPanelRef = useRef<HTMLElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const activeElement = document.activeElement;
    previouslyFocusedElementRef.current = activeElement instanceof HTMLElement ? activeElement : null;

    return () => {
      const previouslyFocusedElement = previouslyFocusedElementRef.current;
      if (previouslyFocusedElement && document.contains(previouslyFocusedElement)) {
        previouslyFocusedElement.focus();
      }
    };
  }, []);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, [posting.id]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !analyzing) {
        onClose();
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [analyzing, onClose]);

  const trapFocus = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") {
      return;
    }

    const panel = modalPanelRef.current;
    if (!panel) {
      return;
    }

    const focusableElements = focusableModalElements(panel);
    if (focusableElements.length === 0) {
      event.preventDefault();
      panel.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !analyzing) {
          onClose();
        }
      }}
    >
      <section
        className="modal-panel candidate-picker-modal"
        ref={modalPanelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="candidate-picker-title"
        aria-describedby="candidate-picker-description"
        tabIndex={-1}
        onKeyDown={trapFocus}
      >
        <div className="modal-heading">
          <div>
            <Target size={19} />
            <h2 id="candidate-picker-title">Analyze candidate</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Close" disabled={analyzing} onClick={onClose}>
            <XCircle size={20} />
          </button>
        </div>

        <div className="candidate-picker-context">
          <strong>{posting.title}</strong>
          <span id="candidate-picker-description">Select a candidate to analyze their latest uploaded resume.</span>
        </div>

        <form
          className="candidate-search-form"
          onSubmit={(event) => {
            event.preventDefault();
            onRefresh();
          }}
        >
          <label className="field">
            <span>Search candidate name</span>
            <div className="input-with-icon">
              <Search size={18} />
              <input
                ref={searchInputRef}
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Sydney Nguyen, Alex Chen..."
              />
            </div>
          </label>
          <button className="secondary-button" type="submit" disabled={status === "loading" || analyzing}>
            {status === "loading" ? <Loader2 className="spin" size={18} /> : <SearchCheck size={18} />}
            Search
          </button>
        </form>

        {error && (
          <div className="notice error compact-notice">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="candidate-list">
          {status === "loading" && candidates.length === 0 ? (
            <div className="candidate-loading">
              <Loader2 className="spin" size={24} />
              <span>Searching candidates</span>
            </div>
          ) : candidates.length === 0 ? (
            <p className="muted">No candidates match that name.</p>
          ) : (
            candidates.map((candidate) => {
              const latestResume = candidate.latestResume;
              return (
                <button
                  className="candidate-option"
                  type="button"
                  key={candidate.id}
                  disabled={analyzing || !latestResume}
                  onClick={() => onAnalyze(candidate)}
                >
                  <span className="candidate-avatar">
                    <UserRound size={18} />
                  </span>
                  <span className="candidate-option-body">
                    <strong>{candidate.name}</strong>
                    <span>{candidate.email}</span>
                    {latestResume ? (
                      <span>
                        {latestResume.fileName} | version {latestResume.versionNumber} |{" "}
                        {Math.ceil(latestResume.characterCount / 1000)}k chars
                      </span>
                    ) : (
                      <span>No resume uploaded</span>
                    )}
                  </span>
                  <StatusBadge tone={latestResume ? "success" : "warning"}>
                    {latestResume ? "Select" : "No resume"}
                  </StatusBadge>
                </button>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};

const dateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const monthLabel = (date: Date) =>
  new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date);

const fullDateLabel = (date: Date) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(date);

const meetingDefaultDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date;
};

export const MeetingInviteModal = ({
  job,
  status,
  error,
  onClose,
  onSend
}: {
  job: JobRecord;
  status: Status;
  error: string;
  onClose: () => void;
  onSend: (details: { startsAt: string; durationMinutes: number; message: string }) => Promise<void> | void;
}) => {
  const initialDate = useMemo(() => meetingDefaultDate(), [job.id]);
  const [selectedDate, setSelectedDate] = useState(() => dateInputValue(initialDate));
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
  const [time, setTime] = useState("09:00");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [message, setMessage] = useState("");
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const nextDate = meetingDefaultDate();
    setSelectedDate(dateInputValue(nextDate));
    setVisibleMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    setTime("09:00");
    setDurationMinutes(30);
    setMessage([
      `Hi ${job.userName ?? "there"},`,
      "",
      `We would like to schedule a meeting about ${job.jobTitle}.`,
      "",
      "Job description:",
      job.jobDescription || "No job description was stored for this application."
    ].join("\n"));
  }, [job.id, job.jobDescription, job.jobTitle, job.userName]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    const focusableElements = focusableModalElements(panel);
    focusableElements[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && status !== "loading") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const elements = focusableModalElements(panel);
      if (elements.length === 0) {
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, status]);

  const days = useMemo(() => {
    const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const start = new Date(firstDay);
    start.setDate(firstDay.getDate() - firstDay.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [visibleMonth]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      return;
    }

    const startsAt = new Date(`${selectedDate}T${time}:00`);
    await onSend({
      startsAt: startsAt.toISOString(),
      durationMinutes,
      message
    });
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-panel meeting-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="meeting-invite-title"
        ref={panelRef}
      >
        <div className="modal-heading">
          <div>
            <Clock3 size={19} />
            <h2 id="meeting-invite-title">Schedule meeting</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Close" disabled={status === "loading"} onClick={onClose}>
            <XCircle size={18} />
          </button>
        </div>

        <div className="candidate-picker-context">
          <strong>{job.userName ?? "Candidate"} | {job.userEmail ?? "No email"}</strong>
          <span>{job.jobTitle}</span>
        </div>

        <form className="meeting-form" onSubmit={(event) => void submit(event)}>
          <section className="meeting-calendar" aria-label="Meeting date">
            <div className="meeting-calendar-header">
              <button
                className="icon-button"
                type="button"
                aria-label="Previous month"
                onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
              >
                <ChevronDown className="rotate-left" size={17} />
              </button>
              <strong>{monthLabel(visibleMonth)}</strong>
              <button
                className="icon-button"
                type="button"
                aria-label="Next month"
                onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
              >
                <ChevronDown className="rotate-right" size={17} />
              </button>
            </div>
            <div className="meeting-calendar-grid">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <span className="meeting-weekday" key={day}>{day}</span>
              ))}
              {days.map((date) => {
                const value = dateInputValue(date);
                const selected = value === selectedDate;
                const muted = date.getMonth() !== visibleMonth.getMonth();
                return (
                  <button
                    className={`meeting-day${selected ? " selected" : ""}${muted ? " muted-day" : ""}`}
                    type="button"
                    key={value}
                    aria-label={fullDateLabel(date)}
                    aria-pressed={selected}
                    onClick={() => setSelectedDate(value)}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="meeting-controls">
            <label className="field compact-field">
              <span>Time</span>
              <div className="input-with-icon">
                <Clock3 size={18} />
                <input
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]"
                  placeholder="09:00"
                  required
                />
              </div>
            </label>
            <label className="field compact-field">
              <span>Duration minutes</span>
              <div className="input-with-icon">
                <Clock3 size={18} />
                <input
                  inputMode="numeric"
                  value={durationMinutes}
                  onChange={(event) => setDurationMinutes(Number(event.target.value) || 30)}
                  placeholder="30"
                  min={15}
                  max={240}
                  required
                />
              </div>
            </label>
          </div>

          <label className="field compact-field">
            <span>Invite message</span>
            <textarea
              className="compact-textarea meeting-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </label>

          {error && (
            <div className="notice error compact-notice">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <button className="primary-button" type="submit" disabled={status === "loading"}>
            {status === "loading" ? <Loader2 className="spin" size={18} /> : <Mail size={18} />}
            Send invite
          </button>
        </form>
      </div>
    </div>
  );
};

export const AdminOverview = ({ overview }: { overview: AdminOverviewResponse }) => (
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

export const healthTone = (status: "online" | "degraded" | "offline"): "success" | "warning" | "danger" => {
  if (status === "online") {
    return "success";
  }
  if (status === "degraded") {
    return "warning";
  }
  return "danger";
};

export const AdminSettingsPanel = ({
  settings,
  status,
  error,
  onSave
}: {
  settings?: PublicAppSettings;
  status: Status;
  error: string;
  onSave: (settings: Record<string, unknown>) => Promise<void> | void;
}) => {
  const [draft, setDraft] = useState<Record<string, string | boolean>>({});
  const responsesButtonRef = useRef<HTMLButtonElement | null>(null);
  const chatButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!settings) {
      return;
    }

    setDraft({
      openaiApiKey: "",
      openaiBaseUrl: settings.openaiBaseUrl ?? "",
      llmModel: settings.llmModel,
      llmApiStyle: settings.llmApiStyle,
      embeddingApiKey: "",
      embeddingBaseUrl: settings.embeddingBaseUrl ?? "",
      embeddingModel: settings.embeddingModel,
      embeddingDimensions: String(settings.embeddingDimensions),
      smtpHost: settings.smtpHost ?? "",
      smtpPort: String(settings.smtpPort),
      smtpSecure: settings.smtpSecure,
      smtpUser: settings.smtpUser ?? "",
      smtpPass: "",
      emailFrom: settings.emailFrom ?? "",
      emailFromName: settings.emailFromName
    });
  }, [settings]);

  const update = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.currentTarget;
    setDraft((current) => ({ ...current, [field]: value }));
  };
  const setField = (field: string, value: string | boolean) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };
  const selectLlmApiStyle = (value: "responses" | "chat") => {
    setField("llmApiStyle", value);
    window.requestAnimationFrame(() => {
      (value === "responses" ? responsesButtonRef.current : chatButtonRef.current)?.focus();
    });
  };
  const handleLlmStyleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, value: "responses" | "chat") => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "ArrowUp" && event.key !== "ArrowDown") {
      return;
    }

    event.preventDefault();
    selectLlmApiStyle(value);
  };
  const toggleSmtpSecure = () => setField("smtpSecure", !draft.smtpSecure);
  const handleSmtpSecureKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    toggleSmtpSecure();
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSave({
      ...draft,
      embeddingDimensions: Number(draft.embeddingDimensions) || null,
      smtpPort: Number(draft.smtpPort) || null
    });
  };

  return (
    <section className="surface-card full admin-settings-view">
      <div className="panel-heading split-heading">
        <div>
          <SettingsIcon size={19} />
          <h2>Settings</h2>
        </div>
        <StatusBadge tone={status === "loading" ? "warning" : "neutral"}>
          {status === "loading" ? "Saving" : "Admin"}
        </StatusBadge>
      </div>

      {error && (
        <div className="notice error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {!settings ? (
        <div className="empty-state compact-empty">
          <div className="empty-mark">
            <Loader2 className="spin" size={34} />
          </div>
          <h2>Loading settings</h2>
          <p>Reading database settings and environment fallbacks.</p>
        </div>
      ) : (
        <form className="settings-form" onSubmit={(event) => void submit(event)}>
          <section className="settings-section">
            <h3>LLM provider</h3>
            <label className="field">
              <span>OpenAI API key</span>
              <input
                type="password"
                value={String(draft.openaiApiKey ?? "")}
                onChange={update("openaiApiKey")}
                autoComplete="off"
                placeholder={settings.openaiApiKeyConfigured ? "Configured. Leave blank to keep current value." : "Falls back to OPENAI_API_KEY"}
              />
            </label>
            <label className="field">
              <span>OpenAI base URL</span>
              <input value={String(draft.openaiBaseUrl ?? "")} onChange={update("openaiBaseUrl")} placeholder="https://api.openai.com/v1" />
            </label>
            <label className="field">
              <span>LLM model</span>
              <input value={String(draft.llmModel ?? "")} onChange={update("llmModel")} placeholder="gpt-5.5" />
            </label>
            <div className="field">
              <span>LLM API style</span>
              <span className="segmented-control settings-segmented" role="radiogroup" aria-label="LLM API style">
                <button
                  className={draft.llmApiStyle === "responses" ? "active" : ""}
                  type="button"
                  role="radio"
                  aria-checked={draft.llmApiStyle === "responses"}
                  tabIndex={draft.llmApiStyle === "responses" ? 0 : -1}
                  ref={responsesButtonRef}
                  onClick={() => selectLlmApiStyle("responses")}
                  onKeyDown={(event) => handleLlmStyleKeyDown(event, "chat")}
                >
                  Responses
                </button>
                <button
                  className={draft.llmApiStyle === "chat" ? "active" : ""}
                  type="button"
                  role="radio"
                  aria-checked={draft.llmApiStyle === "chat"}
                  tabIndex={draft.llmApiStyle === "chat" ? 0 : -1}
                  ref={chatButtonRef}
                  onClick={() => selectLlmApiStyle("chat")}
                  onKeyDown={(event) => handleLlmStyleKeyDown(event, "responses")}
                >
                  Chat completions
                </button>
              </span>
            </div>
          </section>

          <section className="settings-section">
            <h3>Embedding provider</h3>
            <label className="field">
              <span>Embedding API key</span>
              <input
                type="password"
                value={String(draft.embeddingApiKey ?? "")}
                onChange={update("embeddingApiKey")}
                autoComplete="off"
                placeholder={settings.embeddingApiKeyConfigured ? "Configured. Leave blank to keep current value." : "Falls back to EMBEDDING_API_KEY or OPENAI_API_KEY"}
              />
            </label>
            <label className="field">
              <span>Embedding base URL</span>
              <input value={String(draft.embeddingBaseUrl ?? "")} onChange={update("embeddingBaseUrl")} placeholder="https://api.openai.com/v1" />
            </label>
            <label className="field">
              <span>Embedding model</span>
              <input value={String(draft.embeddingModel ?? "")} onChange={update("embeddingModel")} placeholder="text-embedding-3-small" />
            </label>
            <label className="field">
              <span>Embedding dimensions</span>
              <input inputMode="numeric" value={String(draft.embeddingDimensions ?? "")} onChange={update("embeddingDimensions")} placeholder="768" />
            </label>
          </section>

          <section className="settings-section">
            <h3>Email service</h3>
            <label className="field">
              <span>SMTP host</span>
              <input value={String(draft.smtpHost ?? "")} onChange={update("smtpHost")} placeholder="smtp.gmail.com" />
            </label>
            <label className="field">
              <span>SMTP port</span>
              <input inputMode="numeric" value={String(draft.smtpPort ?? "")} onChange={update("smtpPort")} placeholder="587" />
            </label>
            <button
              className={`settings-check ${draft.smtpSecure ? "active" : ""}`}
              type="button"
              role="checkbox"
              aria-checked={Boolean(draft.smtpSecure)}
              onClick={toggleSmtpSecure}
              onKeyDown={handleSmtpSecureKeyDown}
            >
              <span className="settings-check-mark" aria-hidden="true">
                {draft.smtpSecure ? <CheckCircle2 size={14} /> : null}
              </span>
              <span>Use implicit TLS</span>
            </button>
            <label className="field">
              <span>SMTP user</span>
              <input value={String(draft.smtpUser ?? "")} onChange={update("smtpUser")} placeholder="your-account@gmail.com" />
            </label>
            <label className="field">
              <span>SMTP password</span>
              <input
                type="password"
                value={String(draft.smtpPass ?? "")}
                onChange={update("smtpPass")}
                autoComplete="off"
                placeholder={settings.smtpPassConfigured ? "Configured. Leave blank to keep current value." : "Gmail app password or provider password"}
              />
            </label>
            <label className="field">
              <span>From email</span>
              <input value={String(draft.emailFrom ?? "")} onChange={update("emailFrom")} placeholder="your-account@gmail.com" />
            </label>
            <label className="field">
              <span>From name</span>
              <input value={String(draft.emailFromName ?? "")} onChange={update("emailFromName")} placeholder="Roos Admin" />
            </label>
          </section>

          <button className="primary-button" type="submit" disabled={status === "loading"}>
            {status === "loading" ? <Loader2 className="spin" size={18} /> : <CheckCircle2 size={18} />}
            Save settings
          </button>
        </form>
      )}
    </section>
  );
};

export const SystemHealthPanel = ({
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
