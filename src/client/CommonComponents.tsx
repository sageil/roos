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
import type { JobRecord } from "../shared/types";
import { themeLabels, themeOrder } from "./appConstants";
import type { PrivacyRedactionForm, Status, ThemeName } from "./appTypes";
import { fitLabel, fitTone, formatLocalDate } from "./appUtils";
import { useInfiniteScroll } from "./useInfiniteScroll";

export const JobFitBadge = ({ job }: { job: JobRecord }) =>
  typeof job.fitScore === "number" ? (
    <StatusBadge tone={fitTone(job.fitScore)}>
      {fitLabel(job.fitScore)} | {job.fitScore}/100
    </StatusBadge>
  ) : (
    <StatusBadge tone="neutral">No fit score</StatusBadge>
  );

export const JobKindBadge = ({ job }: { job: JobRecord }) =>
  job.analysisKind === "candidate_assessment" ? (
    <StatusBadge tone="warning">Candidate assessment</StatusBadge>
  ) : (
    <StatusBadge tone="neutral">Application</StatusBadge>
  );

export const StatusBadge = ({
  tone = "neutral",
  children
}: {
  tone?: "neutral" | "success" | "warning" | "danger";
  children: React.ReactNode;
}) => <span className={`status-badge ${tone}`}>{children}</span>;

export const KangarooLogo = () => (
  <span className="kangaroo-logo" role="img" aria-label="Kangaroo logo" />
);

export const ThemePicker = ({
  value,
  onChange
}: {
  value: ThemeName;
  onChange: (value: ThemeName) => void;
}) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || !triggerRef.current?.parentElement?.contains(target)) {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", closeOnPointerDown);
    return () => window.removeEventListener("pointerdown", closeOnPointerDown);
  }, [open]);

  const focusItem = (index: number) => {
    const boundedIndex = (index + themeOrder.length) % themeOrder.length;
    itemRefs.current[boundedIndex]?.focus();
  };

  const selectTheme = (themeName: ThemeName) => {
    onChange(themeName);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    setOpen(true);
    window.requestAnimationFrame(() => focusItem(themeOrder.indexOf(value)));
  };

  const handleItemKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number, themeName: ThemeName) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(index + 1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(index - 1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusItem(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      focusItem(themeOrder.length - 1);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectTheme(themeName);
    }
  };

  return (
    <div className="theme-picker">
      <button
        className="theme-picker-trigger"
        type="button"
        ref={triggerRef}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Theme: ${themeLabels[value]}`}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
      >
        <Palette size={16} />
        <span>{themeLabels[value]}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="theme-picker-menu" role="menu" aria-label="Theme options">
          {themeOrder.map((themeName, index) => (
            <button
              className="theme-picker-item"
              type="button"
              role="menuitemradio"
              aria-checked={themeName === value}
              key={themeName}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              onClick={() => selectTheme(themeName)}
              onKeyDown={(event) => handleItemKeyDown(event, index, themeName)}
            >
              <span>{themeLabels[themeName]}</span>
              {themeName === value && <CheckCircle2 size={15} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const InfiniteListFooter = ({
  status,
  hasMore,
  itemCount,
  loadingLabel,
  moreLabel = "Load more",
  endLabel = "End of results",
  onLoadMore
}: {
  status: Status;
  hasMore: boolean;
  itemCount: number;
  loadingLabel: string;
  moreLabel?: string;
  endLabel?: string;
  onLoadMore: () => void;
}) => {
  const sentinelRef = useInfiniteScroll({
    enabled: hasMore && status !== "loading",
    onLoadMore
  });

  if (itemCount === 0) {
    return null;
  }

  return (
    <div className="infinite-list-footer" ref={sentinelRef} aria-live="polite">
      {status === "loading" ? (
        <>
          <Loader2 className="spin" size={17} />
          <span>{loadingLabel}</span>
        </>
      ) : hasMore ? (
        <button className="secondary-button compact-button" type="button" onClick={onLoadMore}>
          <ChevronDown size={16} />
          {moreLabel}
        </button>
      ) : (
        <span>{endLabel}</span>
      )}
    </div>
  );
};

export const PrivacyReviewFields = ({
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
        <div className="input-with-icon">
          <UserRound size={18} />
          <input value={value.name} onChange={update("name")} placeholder="Candidate name" />
        </div>
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

export const ListBlock = ({
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

export const MetricTile = ({
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

export const JobHistory = ({ jobs, isAdmin }: { jobs: JobRecord[]; isAdmin: boolean }) => (
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
                {formatLocalDate(job.applicationDate)} | {job.status}
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
