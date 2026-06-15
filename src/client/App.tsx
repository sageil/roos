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
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AdminUserDetailRecord,
  AdminUsersResponse,
  AppSettingsResponse,
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
  PublicAppSettings,
  RegisterResponse,
  ResumeVersionRecord,
  SystemHealthResponse,
  UpdateProfileResponse,
  UploadResumeResponse,
  UserRecord
} from "../shared/types";
import {
  AdminOverview,
  AdminSettingsPanel,
  AdminUsersPanel,
  ApplicationSearchPanel,
  CandidatePickerModal,
  HREvaluationDetails,
  InfiniteListFooter,
  InterviewQuestionsEditor,
  JobSearchPanel,
  KangarooLogo,
  ListBlock,
  MeetingInviteModal,
  MetricTile,
  PrivacyReviewFields,
  ProfileApplications,
  StatusBadge,
  SystemHealthPanel,
  ThemePicker
} from "./AppComponents";
import {
  adminOnlyViews,
  appSlogan,
  authStorageKey,
  defaultAuthenticatedView,
  listPageSize,
  passwordRuleLabels,
  routeForView,
  themeStorageKey
} from "./appConstants";
import type { ActiveView, PrivacyRedactionForm, Status, ThemeName } from "./appTypes";
import {
  appendUniqueById,
  defaultPrivacyRedactionForm,
  evidenceRelevanceLabel,
  filenameFromContentDisposition,
  fitLabel,
  formatFileSize,
  formatLocalDate,
  formatLocalDateTime,
  privacyPreviewToForm,
  redactionTotalLabel,
  serializePrivacyRedactions,
  storedTheme,
  today,
  viewFromPath
} from "./appUtils";

export const App = () => {
  const [theme, setTheme] = useState<ThemeName>(() => storedTheme());
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [jobsHasMore, setJobsHasMore] = useState(false);
  const [jobsStatus, setJobsStatus] = useState<Status>("idle");
  const [jobPostings, setJobPostings] = useState<JobPostingRecord[]>([]);
  const [jobPostingsHasMore, setJobPostingsHasMore] = useState(false);
  const [jobPostingsStatus, setJobPostingsStatus] = useState<Status>("idle");
  const [jobSearchResults, setJobSearchResults] = useState<JobPostingRecord[]>([]);
  const [jobSearch, setJobSearch] = useState("");
  const [jobSearchStatus, setJobSearchStatus] = useState<Status>("idle");
  const [jobSearchError, setJobSearchError] = useState("");
  const [jobSearchHasMore, setJobSearchHasMore] = useState(false);
  const [applicationSearch, setApplicationSearch] = useState("");
  const [applicationSearchResults, setApplicationSearchResults] = useState<JobRecord[]>([]);
  const [applicationSearchStatus, setApplicationSearchStatus] = useState<Status>("idle");
  const [applicationSearchError, setApplicationSearchError] = useState("");
  const [applicationSearchHasMore, setApplicationSearchHasMore] = useState(false);
  const [selectedPostingApplicationsId, setSelectedPostingApplicationsId] = useState<number | null>(null);
  const [selectedPostingApplications, setSelectedPostingApplications] = useState<JobRecord[]>([]);
  const [selectedPostingApplicationsStatus, setSelectedPostingApplicationsStatus] = useState<Status>("idle");
  const [selectedPostingApplicationsError, setSelectedPostingApplicationsError] = useState("");
  const [selectedPostingApplicationsHasMore, setSelectedPostingApplicationsHasMore] = useState(false);
  const [token, setToken] = useState(() => localStorage.getItem(authStorageKey) || "");
  const [user, setUser] = useState<UserRecord | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [loginEmail, setLoginEmail] = useState("admin@example.com.au");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginStatus, setLoginStatus] = useState<Status>("idle");
  const [loginError, setLoginError] = useState("");
  const [adminOverview, setAdminOverview] = useState<AdminOverviewResponse | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUserDetailRecord[]>([]);
  const [adminUsersSearch, setAdminUsersSearch] = useState("");
  const [adminUsersStatus, setAdminUsersStatus] = useState<Status>("idle");
  const [adminUsersError, setAdminUsersError] = useState("");
  const [adminUsersHasMore, setAdminUsersHasMore] = useState(false);
  const [candidatePickerPosting, setCandidatePickerPosting] = useState<JobPostingRecord | null>(null);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateResults, setCandidateResults] = useState<AdminUserDetailRecord[]>([]);
  const [candidateStatus, setCandidateStatus] = useState<Status>("idle");
  const [candidateError, setCandidateError] = useState("");
  const [systemHealth, setSystemHealth] = useState<SystemHealthResponse | null>(null);
  const [systemHealthStatus, setSystemHealthStatus] = useState<Status>("idle");
  const [systemHealthError, setSystemHealthError] = useState("");
  const [appSettings, setAppSettings] = useState<PublicAppSettings | undefined>(undefined);
  const [appSettingsStatus, setAppSettingsStatus] = useState<Status>("idle");
  const [appSettingsError, setAppSettingsError] = useState("");
  const [activeView, setActiveView] = useState<ActiveView>(() => viewFromPath(window.location.pathname));
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileNotice, setProfileNotice] = useState("");
  const [profileStatus, setProfileStatus] = useState<Status>("idle");
  const [profileError, setProfileError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");
  const [passwordChangeStatus, setPasswordChangeStatus] = useState<Status>("idle");
  const [passwordChangeError, setPasswordChangeError] = useState("");
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
  const [meetingInviteJob, setMeetingInviteJob] = useState<JobRecord | null>(null);
  const [meetingInviteStatus, setMeetingInviteStatus] = useState<Status>("idle");
  const [meetingInviteError, setMeetingInviteError] = useState("");
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
  const newPasswordChecks = {
    length: newPassword.length >= 12,
    lowercase: /[a-z]/.test(newPassword),
    uppercase: /[A-Z]/.test(newPassword),
    number: /[0-9]/.test(newPassword)
  };
  const newPasswordValid = Object.values(newPasswordChecks).every(Boolean);
  const newPasswordsMatch = newPasswordConfirmation.length > 0 && newPassword === newPasswordConfirmation;
  const hasProfileResume = resumeVersions.length > 0;
  const latestResume = resumeVersions[0];
  const latestResumeCreatedAt = latestResume ? Date.parse(latestResume.createdAt) : Number.NaN;
  const latestApplicationByPostingId = useMemo(() => {
    const applicationMap = new Map<number, JobRecord>();
    for (const job of [...jobs, ...applicationSearchResults]) {
      if (!job.jobPostingId || job.analysisKind === "candidate_assessment") {
        continue;
      }

      const current = applicationMap.get(job.jobPostingId);
      if (!current || Date.parse(job.createdAt) > Date.parse(current.createdAt)) {
        applicationMap.set(job.jobPostingId, job);
      }
    }

    return applicationMap;
  }, [applicationSearchResults, jobs]);
  const postingApplicationActions = useMemo(() => {
    const actionMap = new Map<number, { latestApplication: JobRecord; canReanalyze: boolean }>();
    for (const [postingId, latestApplication] of latestApplicationByPostingId) {
      actionMap.set(postingId, {
        latestApplication,
        canReanalyze: Number.isFinite(latestResumeCreatedAt) && latestResumeCreatedAt > Date.parse(latestApplication.createdAt)
      });
    }

    return actionMap;
  }, [latestApplicationByPostingId, latestResumeCreatedAt]);
  const hasNewerResumeForJob = (job: JobRecord) =>
    Boolean(
      job.jobPostingId &&
      Number.isFinite(latestResumeCreatedAt) &&
      latestResumeCreatedAt > Date.parse(job.createdAt)
    );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(themeStorageKey, theme);
  }, [theme]);

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
    setJobsHasMore(false);
    setJobsStatus("idle");
    setJobPostings([]);
    setJobPostingsHasMore(false);
    setJobPostingsStatus("idle");
    setJobSearchResults([]);
    setJobSearch("");
    setJobSearchStatus("idle");
    setJobSearchError("");
    setJobSearchHasMore(false);
    setApplicationSearch("");
    setApplicationSearchResults([]);
    setApplicationSearchStatus("idle");
    setApplicationSearchError("");
    setApplicationSearchHasMore(false);
    setSelectedPostingApplicationsId(null);
    setSelectedPostingApplications([]);
    setSelectedPostingApplicationsStatus("idle");
    setSelectedPostingApplicationsError("");
    setSelectedPostingApplicationsHasMore(false);
    setAdminOverview(null);
    setAdminUsers([]);
    setAdminUsersSearch("");
    setAdminUsersStatus("idle");
    setAdminUsersError("");
    setAdminUsersHasMore(false);
    setCandidatePickerPosting(null);
    setCandidateSearch("");
    setCandidateResults([]);
    setCandidateStatus("idle");
    setCandidateError("");
    setSystemHealth(null);
    setSystemHealthStatus("idle");
    setSystemHealthError("");
    setAppSettings(undefined);
    setAppSettingsStatus("idle");
    setAppSettingsError("");
    setResult(null);
    navigateToView(defaultAuthenticatedView, { replace: true });
    setProfileName("");
    setProfileEmail("");
    setCurrentPassword("");
    setNewPassword("");
    setNewPasswordConfirmation("");
    setPasswordChangeStatus("idle");
    setPasswordChangeError("");
    setResumeUploadPrivacy(defaultPrivacyRedactionForm());
    setResumeUploadPrivacyStatus("idle");
    setResumeUploadPrivacyError("");
    setResumeVersions([]);
    setResumeUploadRedactionTotal(null);
  };

  const expireSession = () => {
    clearSession();
    setLoginStatus("error");
    setLoginError("Session expired. Sign in again.");
    setActiveView(defaultAuthenticatedView);
    if (window.location.pathname !== "/") {
      window.history.replaceState({}, "", "/");
    }
  };

  const authenticatedFetch: typeof fetch = async (input, init) => {
    const response = await fetch(input, init);
    if (response.status === 401) {
      expireSession();
    }
    return response;
  };

  const readApiJson = async <T,>(response: Response, fallbackMessage: string): Promise<T> => {
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      throw new Error(response.ok ? fallbackMessage : `${fallbackMessage} Refresh and try again.`);
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error((data as { error?: string }).error || fallbackMessage);
    }

    return data as T;
  };

  const loadJobs = async (activeToken = token, options: { append?: boolean; offset?: number } = {}) => {
    if (!activeToken) {
      setJobs([]);
      setJobsHasMore(false);
      setJobsStatus("idle");
      return;
    }

    setJobsStatus("loading");
    const offset = options.offset ?? 0;
    const params = new URLSearchParams({
      limit: String(listPageSize),
      offset: String(offset)
    });
    const response = await authenticatedFetch(`/api/jobs?${params.toString()}`, {
      headers: authHeaders(activeToken)
    });
    if (!response.ok) {
      setJobsStatus("error");
      return;
    }

    const data = (await response.json()) as JobsResponse;
    setJobs((current) => options.append ? appendUniqueById(current, data.jobs) : data.jobs);
    setJobsHasMore(data.jobs.length === listPageSize);
    setJobsStatus("success");
  };

  const loadAdminOverview = async (activeToken = token) => {
    if (!activeToken) {
      setAdminOverview(null);
      return;
    }

    const response = await authenticatedFetch("/api/admin/overview", {
      headers: authHeaders(activeToken)
    });
    if (!response.ok) {
      setAdminOverview(null);
      return;
    }

    setAdminOverview((await response.json()) as AdminOverviewResponse);
  };

  const loadAdminUsers = async (
    activeToken = token,
    search = adminUsersSearch,
    options: { append?: boolean; offset?: number } = {}
  ) => {
    if (!activeToken) {
      setAdminUsers([]);
      setAdminUsersHasMore(false);
      return;
    }

    setAdminUsersError("");
    setAdminUsersStatus("loading");
    try {
      const offset = options.offset ?? 0;
      const params = new URLSearchParams({
        limit: String(listPageSize),
        offset: String(offset)
      });
      const trimmedSearch = search.trim();
      if (trimmedSearch) {
        params.set("search", trimmedSearch);
      }

      const response = await authenticatedFetch(`/api/admin/users?${params.toString()}`, {
        headers: authHeaders(activeToken)
      });
      const data = await readApiJson<AdminUsersResponse>(response, "User search failed.");

      const users = data.users;
      setAdminUsers((current) => options.append ? appendUniqueById(current, users) : users);
      setAdminUsersHasMore(users.length === listPageSize);
      setAdminUsersStatus("success");
    } catch (caught) {
      setAdminUsersStatus("error");
      setAdminUsersError(caught instanceof Error ? caught.message : "User search failed.");
    }
  };

  const loadCandidateSearch = async (
    activeToken = token,
    search = candidateSearch,
    excludeAssessedForPostingId = candidatePickerPosting?.id
  ) => {
    if (!activeToken) {
      setCandidateResults([]);
      return;
    }

    setCandidateError("");
    setCandidateStatus("loading");
    try {
      const params = new URLSearchParams({ limit: "25" });
      const trimmedSearch = search.trim();
      if (trimmedSearch) {
        params.set("search", trimmedSearch);
      }
      if (excludeAssessedForPostingId) {
        params.set("excludeAssessedForPostingId", String(excludeAssessedForPostingId));
      }

      const response = await authenticatedFetch(`/api/admin/users?${params.toString()}`, {
        headers: authHeaders(activeToken)
      });
      const data = await readApiJson<AdminUsersResponse>(response, "Candidate search failed.");

      setCandidateResults(data.users);
      setCandidateStatus("success");
    } catch (caught) {
      setCandidateStatus("error");
      setCandidateError(caught instanceof Error ? caught.message : "Candidate search failed.");
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
      const response = await authenticatedFetch("/api/admin/system-health", {
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

  const loadAppSettings = async (activeToken = token) => {
    if (!activeToken) {
      setAppSettings(undefined);
      return;
    }

    setAppSettingsError("");
    setAppSettingsStatus("loading");
    try {
      const response = await authenticatedFetch("/api/admin/settings", {
        headers: authHeaders(activeToken)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Settings load failed.");
      }

      setAppSettings((data as AppSettingsResponse).settings);
      setAppSettingsStatus("success");
    } catch (caught) {
      setAppSettingsStatus("error");
      setAppSettingsError(caught instanceof Error ? caught.message : "Settings load failed.");
    }
  };

  const saveAppSettings = async (settings: Record<string, unknown>) => {
    setAppSettingsError("");
    setAppSettingsStatus("loading");
    try {
      const response = await authenticatedFetch("/api/admin/settings", {
        method: "PATCH",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(settings)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Settings update failed.");
      }

      setAppSettings((data as AppSettingsResponse).settings);
      setAppSettingsStatus("success");
    } catch (caught) {
      setAppSettingsStatus("error");
      setAppSettingsError(caught instanceof Error ? caught.message : "Settings update failed.");
    }
  };

  const loadJobPostings = async (activeToken = token, options: { append?: boolean; offset?: number } = {}) => {
    if (!activeToken) {
      setJobPostings([]);
      setJobSearchResults([]);
      setJobSearchHasMore(false);
      setJobPostingsHasMore(false);
      setJobPostingsStatus("idle");
      return;
    }

    setJobPostingsStatus("loading");
    const offset = options.offset ?? 0;
    const params = new URLSearchParams({
      limit: String(listPageSize),
      offset: String(offset)
    });
    const response = await authenticatedFetch(`/api/job-postings?${params.toString()}`, {
      headers: authHeaders(activeToken)
    });
    if (!response.ok) {
      setJobPostingsStatus("error");
      return;
    }

    const data = (await response.json()) as JobPostingsResponse;
    setJobPostings((current) => options.append ? appendUniqueById(current, data.jobPostings) : data.jobPostings);
    setJobPostingsHasMore(data.jobPostings.length === listPageSize);
    setJobPostingsStatus("success");
    if (!jobSearch.trim()) {
      setJobSearchResults((current) => options.append ? appendUniqueById(current, data.jobPostings) : data.jobPostings);
      setJobSearchHasMore(data.jobPostings.length === listPageSize);
    }
  };

  const loadJobSearch = async (
    activeToken = token,
    search = jobSearch,
    options: { append?: boolean; offset?: number } = {}
  ) => {
    if (!activeToken) {
      setJobSearchResults([]);
      setJobSearchHasMore(false);
      return;
    }

    setJobSearchError("");
    setJobSearchStatus("loading");
    try {
      const offset = options.offset ?? 0;
      const params = new URLSearchParams({
        limit: String(listPageSize),
        offset: String(offset)
      });
      const trimmedSearch = search.trim();
      if (trimmedSearch) {
        params.set("search", trimmedSearch);
      }

      const response = await authenticatedFetch(`/api/job-postings?${params.toString()}`, {
        headers: authHeaders(activeToken)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Job search failed.");
      }

      const postings = (data as JobPostingsResponse).jobPostings;
      setJobSearchResults((current) => options.append ? appendUniqueById(current, postings) : postings);
      setJobSearchHasMore(postings.length === listPageSize);
      setJobSearchStatus("success");
    } catch (caught) {
      setJobSearchStatus("error");
      setJobSearchError(caught instanceof Error ? caught.message : "Job search failed.");
    }
  };

  const loadApplicationSearch = async (
    activeToken = token,
    search = applicationSearch,
    options: { append?: boolean; offset?: number } = {}
  ) => {
    if (!activeToken) {
      setApplicationSearchResults([]);
      setApplicationSearchHasMore(false);
      return;
    }

    setApplicationSearchError("");
    setApplicationSearchStatus("loading");
    try {
      const offset = options.offset ?? 0;
      const params = new URLSearchParams({
        limit: String(listPageSize),
        offset: String(offset)
      });
      const trimmedSearch = search.trim();
      if (trimmedSearch) {
        params.set("search", trimmedSearch);
      }

      const response = await authenticatedFetch(`/api/applications?${params.toString()}`, {
        headers: authHeaders(activeToken)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Application search failed.");
      }

      const jobs = (data as JobsResponse).jobs;
      setApplicationSearchResults((current) => options.append ? appendUniqueById(current, jobs) : jobs);
      setApplicationSearchHasMore(jobs.length === listPageSize);
      setApplicationSearchStatus("success");
    } catch (caught) {
      setApplicationSearchStatus("error");
      setApplicationSearchError(caught instanceof Error ? caught.message : "Application search failed.");
    }
  };

  const loadPostingApplications = async (
    posting: JobPostingRecord,
    activeToken = token,
    options: { append?: boolean; offset?: number } = {}
  ) => {
    if (!activeToken) {
      setSelectedPostingApplications([]);
      setSelectedPostingApplicationsHasMore(false);
      return;
    }

    setSelectedPostingApplicationsId(posting.id);
    setSelectedPostingApplicationsError("");
    setSelectedPostingApplicationsStatus("loading");
    try {
      const offset = options.offset ?? 0;
      const params = new URLSearchParams({
        limit: String(listPageSize),
        offset: String(offset)
      });
      const response = await authenticatedFetch(`/api/admin/job-postings/${posting.id}/applications?${params.toString()}`, {
        headers: authHeaders(activeToken)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Applications failed to load.");
      }

      const jobs = (data as JobPostingApplicationsResponse).jobs;
      setSelectedPostingApplications((current) => options.append ? appendUniqueById(current, jobs) : jobs);
      setSelectedPostingApplicationsHasMore(jobs.length === listPageSize);
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

    const response = await authenticatedFetch("/api/profile", {
      headers: authHeaders(activeToken)
    });
    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as ProfileResponse;
    setUser(data.user);
    setProfileName(data.user.name);
    setProfileEmail(data.user.email);
    setCurrentPassword("");
    setNewPassword("");
    setNewPasswordConfirmation("");
    setPasswordChangeStatus("idle");
    setPasswordChangeError("");
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
      const response = await authenticatedFetch("/api/resumes/privacy-preview", {
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
      const response = await authenticatedFetch("/api/me", {
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
    if (!token || user?.role !== "admin" || !candidatePickerPosting) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void loadCandidateSearch(token, candidateSearch, candidatePickerPosting.id);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [candidatePickerPosting?.id, candidateSearch, token, user?.role]);

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

  useEffect(() => {
    if (!token || user?.role !== "admin" || activeView !== "adminSettings") {
      return;
    }

    void loadAppSettings();
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
      await authenticatedFetch("/api/logout", {
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

  const openAdminSettings = async () => {
    navigateToView("adminSettings");
    await loadAppSettings();
  };

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileError("");
    setProfileStatus("loading");

    try {
      const response = await authenticatedFetch("/api/profile", {
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

  const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordChangeError("");
    setPasswordChangeStatus("loading");

    try {
      if (!currentPassword) {
        throw new Error("Enter your current password.");
      }
      if (!newPasswordValid) {
        throw new Error("New password must meet all listed rules.");
      }
      if (!newPasswordsMatch) {
        throw new Error("Retyped password must match.");
      }

      const response = await authenticatedFetch("/api/profile/password", {
        method: "PATCH",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          currentPassword,
          password: newPassword,
          passwordConfirmation: newPasswordConfirmation
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Password update failed.");
      }

      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirmation("");
      setPasswordChangeStatus("success");
    } catch (caught) {
      setPasswordChangeStatus("error");
      setPasswordChangeError(caught instanceof Error ? caught.message : "Password update failed.");
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
      const response = await authenticatedFetch("/api/resumes", {
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
      const response = await authenticatedFetch(`/api/resumes/${resume.id}/download`, {
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

  const openCandidatePicker = (posting: JobPostingRecord) => {
    setCandidatePickerPosting(posting);
    setCandidateSearch("");
    setCandidateResults([]);
    setCandidateError("");
    setCandidateStatus("loading");
    void loadCandidateSearch(token, "", posting.id);
  };

  const analyzeCandidateLatestResumeToPosting = async (
    posting: JobPostingRecord,
    candidate: AdminUserDetailRecord
  ) => {
    setError("");
    setResult(null);
    setCandidateError("");

    if (!token || !user || user.role !== "admin") {
      setCandidateStatus("error");
      setCandidateError("Admin access is required to analyze a candidate.");
      return;
    }

    if (!candidate.latestResume) {
      setCandidateStatus("error");
      setCandidateError("Choose a candidate with an uploaded resume.");
      return;
    }

    const nextApplicationDate = today();
    setStatus("loading");
    setCandidatePickerPosting(null);
    navigateToView("analysis");

    try {
      const response = await authenticatedFetch(`/api/admin/users/${candidate.id}/analyze/latest`, {
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
      void loadAdminOverview();
      void loadAdminUsers();
      if (selectedPostingApplicationsId === posting.id) {
        void loadPostingApplications(posting);
      }
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Analysis failed.");
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
      const response = await authenticatedFetch("/api/analyze/latest", {
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
      const response = await authenticatedFetch(`/api/admin/jobs/${job.id}/assessment.pdf`, {
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
    const response = await authenticatedFetch(`/api/admin/jobs/${job.id}/interview-questions`, {
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

  const convertCandidateAssessmentToApplication = async (job: JobRecord) => {
    setError("");
    setApplicationSearchError("");
    setSelectedPostingApplicationsError("");
    setAdminUsersError("");

    try {
      const response = await authenticatedFetch(`/api/admin/jobs/${job.id}/convert-to-application`, {
        method: "PATCH",
        headers: authHeaders()
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Application conversion failed.");
      }

      const updatedJob = (data as { job?: JobRecord }).job;
      if (updatedJob) {
        replaceJobInState(updatedJob);
      }

      void loadJobs();
      void loadApplicationSearch();
      void loadJobPostings();
      void loadAdminOverview();
      void loadAdminUsers();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Application conversion failed.";
      if (activeView === "adminUsers") {
        setAdminUsersError(message);
        setAdminUsersStatus("error");
      } else if (activeView === "jobs") {
        setSelectedPostingApplicationsError(message);
        setSelectedPostingApplicationsStatus("error");
      } else if (activeView === "applications") {
        setApplicationSearchError(message);
        setApplicationSearchStatus("error");
      } else {
        setError(message);
        setStatus("error");
      }
    }
  };

  const openMeetingInvite = (job: JobRecord) => {
    setMeetingInviteJob(job);
    setMeetingInviteStatus("idle");
    setMeetingInviteError("");
  };

  const sendMeetingInvite = async ({
    startsAt,
    durationMinutes,
    message
  }: {
    startsAt: string;
    durationMinutes: number;
    message: string;
  }) => {
    if (!meetingInviteJob) {
      return;
    }

    setMeetingInviteStatus("loading");
    setMeetingInviteError("");
    try {
      const response = await authenticatedFetch(`/api/admin/jobs/${meetingInviteJob.id}/meeting-invite`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ startsAt, durationMinutes, message })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Meeting invite failed.");
      }

      setMeetingInviteStatus("success");
      setMeetingInviteJob(null);
    } catch (caught) {
      setMeetingInviteStatus("error");
      setMeetingInviteError(caught instanceof Error ? caught.message : "Meeting invite failed.");
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
      const response = await authenticatedFetch("/api/admin/job-postings", {
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
      if (user?.role === "admin") {
        openCandidatePicker(activePosting);
        return;
      }

      void matchLatestResumeToPosting(activePosting);
      return;
    }

    setJobSearch(job.jobTitle);
    navigateToView("jobs");
    void loadJobSearch(token, job.jobTitle);
  };

  const viewApplication = (job: JobRecord) => {
    setApplicationSearch(job.jobTitle);
    setApplicationSearchResults([job]);
    setApplicationSearchStatus("success");
    setApplicationSearchError("");
    setApplicationSearchHasMore(false);
    navigateToView("applications");
  };

  if (!user) {
    return (
      <main className="app-shell">
        <header className="top-bar">
          <div className="title-row">
            <div className="brand-mark">
              <KangarooLogo />
            </div>
            <div>
              <h1>Roos</h1>
              <p>{appSlogan}</p>
            </div>
          </div>
          <div className="system-strip">
            <ThemePicker value={theme} onChange={setTheme} />
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
                      placeholder="admin@example.com.au"
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
            <KangarooLogo />
          </div>
          <div>
            <h1>Roos</h1>
            <p>{appSlogan}</p>
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
              <button className={`nav-button${activeView === "adminSettings" ? " active" : ""}`} type="button" onClick={openAdminSettings}>
                <SettingsIcon size={16} />
                Settings
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
          <ThemePicker value={theme} onChange={setTheme} />
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
              hasMore={applicationSearchHasMore}
              isAdmin={user.role === "admin"}
              onSearchChange={setApplicationSearch}
              onRefresh={() => void loadApplicationSearch()}
              onLoadMore={() => void loadApplicationSearch(token, applicationSearch, {
                append: true,
                offset: applicationSearchResults.length
              })}
              onUseJob={useJobForNewAnalysis}
              onDownloadAssessment={(job) => void downloadAssessment(job)}
              onConvertToApplication={(job) => convertCandidateAssessmentToApplication(job)}
              onScheduleMeeting={openMeetingInvite}
              onSaveInterviewQuestions={(job, questions) => saveInterviewQuestions(job, questions)}
              canUseJob={user.role === "admin" ? undefined : hasNewerResumeForJob}
              useJobLabel={user.role === "admin" ? undefined : "Re-analyze with latest resume"}
            />
          )}

          {activeView === "jobs" && (
            <JobSearchPanel
              postings={jobSearchResults}
              search={jobSearch}
              status={jobSearchStatus}
              error={jobSearchError}
              hasMore={jobSearchHasMore}
              selectedPostingId={selectedPostingApplicationsId}
              selectedPostingApplications={selectedPostingApplications}
              selectedPostingApplicationsStatus={selectedPostingApplicationsStatus}
              selectedPostingApplicationsError={selectedPostingApplicationsError}
              selectedPostingApplicationsHasMore={selectedPostingApplicationsHasMore}
              onSearchChange={setJobSearch}
              onRefresh={() => void loadJobSearch()}
              onLoadMore={() => void loadJobSearch(token, jobSearch, {
                append: true,
                offset: jobSearchResults.length
              })}
              onUsePosting={(posting) => {
                if (user.role === "admin") {
                  openCandidatePicker(posting);
                  return;
                }

                void matchLatestResumeToPosting(posting);
              }}
              onViewApplications={user.role === "admin" ? (posting) => void loadPostingApplications(posting) : undefined}
              onLoadMorePostingApplications={() => {
                const posting = selectedPostingApplicationsId
                  ? jobSearchResults.find((item) => item.id === selectedPostingApplicationsId)
                  : undefined;
                if (posting) {
                  void loadPostingApplications(posting, token, {
                    append: true,
                    offset: selectedPostingApplications.length
                  });
                }
              }}
              onDownloadAssessment={(job) => void downloadAssessment(job)}
              onConvertToApplication={(job) => convertCandidateAssessmentToApplication(job)}
              onScheduleMeeting={openMeetingInvite}
              onSaveInterviewQuestions={(job, questions) => saveInterviewQuestions(job, questions)}
              isAdmin={user.role === "admin"}
              hasResume={hasProfileResume}
              postingApplicationActions={user.role === "admin" ? undefined : postingApplicationActions}
              onViewOwnApplication={viewApplication}
            />
          )}

          {activeView === "adminUsers" && user.role === "admin" && (
            <AdminUsersPanel
              users={adminUsers}
              search={adminUsersSearch}
              status={adminUsersStatus}
              error={adminUsersError}
              hasMore={adminUsersHasMore}
              onSearchChange={setAdminUsersSearch}
              onRefresh={() => void loadAdminUsers()}
              onLoadMore={() => void loadAdminUsers(token, adminUsersSearch, {
                append: true,
                offset: adminUsers.length
              })}
              onDownloadResume={(resume) => void downloadResume(resume)}
              onDownloadAssessment={(job) => void downloadAssessment(job)}
              onScheduleMeeting={openMeetingInvite}
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

          {activeView === "adminSettings" && user.role === "admin" && (
            <AdminSettingsPanel
              settings={appSettings}
              status={appSettingsStatus}
              error={appSettingsError}
              onSave={saveAppSettings}
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
                    <div className="input-with-icon">
                      <FilePenLine size={18} />
                      <input
                        value={newPostingTitle}
                        onChange={(event) => setNewPostingTitle(event.target.value)}
                        placeholder="Veterinary Receptionist"
                      />
                    </div>
                  </label>

                  <label className="field">
                    <span>Required skills</span>
                    <div className="tag-entry">
                      <div className="input-with-icon">
                        <Tag size={18} />
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
                      </div>
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
                            <span>{posting.status} | {formatLocalDateTime(posting.createdAt)}</span>
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
                            className="assess-candidate-button"
                            type="button"
                            onClick={() => openCandidatePicker(posting)}
                          >
                            <Target size={16} />
                            Assess a candidate
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                  <InfiniteListFooter
                    status={jobPostingsStatus}
                    hasMore={jobPostingsHasMore}
                    itemCount={jobPostings.length}
                    loadingLabel="Loading job postings"
                    onLoadMore={() => void loadJobPostings(token, {
                      append: true,
                      offset: jobPostings.length
                    })}
                  />
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
                    <div className="input-with-icon">
                      <UserRound size={18} />
                      <input
                        value={profileName}
                        onChange={(event) => setProfileName(event.target.value)}
                      />
                    </div>
                  </label>
                  <label className="field">
                    <span>Email</span>
                    <div className="input-with-icon">
                      <Mail size={18} />
                      <input
                        inputMode="email"
                        type="email"
                        value={profileEmail}
                        onChange={(event) => setProfileEmail(event.target.value)}
                      />
                    </div>
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
                  <LockKeyhole size={19} />
                  <h2>Password</h2>
                </div>
                <form className="form-stack profile-form" onSubmit={changePassword}>
                  <label className="field">
                    <span>Current password</span>
                    <div className="input-with-icon">
                      <LockKeyhole size={18} />
                      <input
                        autoComplete="current-password"
                        type="password"
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                      />
                    </div>
                  </label>
                  <label className="field">
                    <span>New password</span>
                    <div className="input-with-icon">
                      <LockKeyhole size={18} />
                      <input
                        autoComplete="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        placeholder="12+ chars, mixed case, number"
                      />
                    </div>
                  </label>
                  <label className="field">
                    <span>Retype new password</span>
                    <div className="input-with-icon">
                      <LockKeyhole size={18} />
                      <input
                        autoComplete="new-password"
                        type="password"
                        value={newPasswordConfirmation}
                        onChange={(event) => setNewPasswordConfirmation(event.target.value)}
                        placeholder="Retype new password"
                      />
                    </div>
                  </label>
                  <div className="password-rules" aria-live="polite">
                    {Object.entries(passwordRuleLabels).map(([rule, label]) => {
                      const satisfied = newPasswordChecks[rule as keyof typeof newPasswordChecks];
                      return (
                        <span className={satisfied ? "satisfied" : ""} key={rule}>
                          {satisfied ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                          {label}
                        </span>
                      );
                    })}
                    <span className={newPasswordsMatch ? "satisfied" : ""}>
                      {newPasswordsMatch ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                      Passwords match
                    </span>
                  </div>
                  <button className="primary-button" disabled={passwordChangeStatus === "loading"} type="submit">
                    {passwordChangeStatus === "loading" ? <Loader2 className="spin" size={18} /> : <CheckCircle2 size={18} />}
                    Change password
                  </button>
                </form>

                {passwordChangeStatus === "success" && (
                  <div className="notice success">
                    <CheckCircle2 size={18} />
                    <span>Password updated.</span>
                  </div>
                )}

                {passwordChangeStatus === "error" && (
                  <div className="notice error">
                    <AlertCircle size={18} />
                    <span>{passwordChangeError}</span>
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
                    <span>
                      <strong>{resumeUploadFile ? "Selected resume" : "Choose resume file"}</strong>
                      <small>{resumeUploadLabel}</small>
                    </span>
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
                        <p>{Math.ceil(resume.characterCount / 1000)}k chars | {formatLocalDateTime(resume.createdAt)}</p>
                      </article>
                    ))
                  )}
                </div>
              </section>

              <ProfileApplications
                jobs={jobs}
                status={jobsStatus}
                hasMore={jobsHasMore}
                isAdmin={user.role === "admin"}
                onUseJob={useJobForNewAnalysis}
                onLoadMore={() => void loadJobs(token, {
                  append: true,
                  offset: jobs.length
                })}
                onDownloadAssessment={(job) => void downloadAssessment(job)}
                onConvertToApplication={(job) => convertCandidateAssessmentToApplication(job)}
                onScheduleMeeting={openMeetingInvite}
                onSaveInterviewQuestions={(job, questions) => saveInterviewQuestions(job, questions)}
                canUseJob={user.role === "admin" ? undefined : hasNewerResumeForJob}
                useJobLabel={user.role === "admin" ? undefined : "Re-analyze with latest resume"}
              />
            </div>
          )}

          {activeView === "analysis" && status === "loading" && (
            <div className="empty-state">
              <div className="empty-mark">
                <Loader2 className="spin" size={34} />
              </div>
              <h2>Checking your fit</h2>
              <p>Reviewing your resume against the role and preparing your application summary.</p>
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
                    Job #{result.job.id} | {formatLocalDate(result.job.applicationDate)} |{" "}
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
                caption={formatLocalDate(result.job.applicationDate)}
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
                caption={formatLocalDateTime(result.job.updatedAt)}
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

      {candidatePickerPosting && (
        <CandidatePickerModal
          posting={candidatePickerPosting}
          candidates={candidateResults}
          search={candidateSearch}
          status={candidateStatus}
          error={candidateError}
          analyzing={status === "loading"}
          onSearchChange={setCandidateSearch}
          onRefresh={() => void loadCandidateSearch()}
          onClose={() => setCandidatePickerPosting(null)}
          onAnalyze={(candidate) => void analyzeCandidateLatestResumeToPosting(candidatePickerPosting, candidate)}
        />
      )}

      {meetingInviteJob && (
        <MeetingInviteModal
          job={meetingInviteJob}
          status={meetingInviteStatus}
          error={meetingInviteError}
          onClose={() => setMeetingInviteJob(null)}
          onSend={sendMeetingInvite}
        />
      )}
    </main>
  );
};
