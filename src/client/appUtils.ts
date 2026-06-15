import type { PrivacyPreviewResponse, UserRecord } from "../shared/types";
import { defaultAuthenticatedView, themeOrder, themeStorageKey } from "./appConstants";
import type { ActiveView, PrivacyRedactionForm, ThemeName } from "./appTypes";

export const appendUniqueById = <T extends { id: number }>(current: T[], next: T[]) => {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...next.filter((item) => !seen.has(item.id))];
};

export const storedTheme = (): ThemeName => {
  const value = localStorage.getItem(themeStorageKey);
  if (value === "launch-light") {
    return "default-light";
  }
  if (value === "launch-dark") {
    return "default-dark";
  }
  if (value === "icy-blue") {
    return "icy-blue-light";
  }
  if (value === "crimson-lit") {
    return "crimson-lit-light";
  }
  return themeOrder.includes(value as ThemeName) ? value as ThemeName : "default-light";
};

export const viewFromPath = (path: string): ActiveView => {
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
    case "/admin/settings":
      return "adminSettings";
    case "/analysis":
      return "analysis";
    default:
      return defaultAuthenticatedView;
  }
};

export const today = () => {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

export const defaultPrivacyRedactionForm = (user?: UserRecord | null): PrivacyRedactionForm => ({
  name: user?.name ?? "",
  emails: user?.email ?? "",
  phones: "",
  addressLines: "",
  links: ""
});

export const splitPrivacyLines = (value: string) =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

export const serializePrivacyRedactions = (form: PrivacyRedactionForm) => ({
  name: form.name.trim(),
  emails: splitPrivacyLines(form.emails),
  phones: splitPrivacyLines(form.phones),
  addressLines: splitPrivacyLines(form.addressLines),
  links: splitPrivacyLines(form.links)
});

export const privacyPreviewToForm = (
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

export const redactionTotalLabel = (total: number) => `${total} privacy ${total === 1 ? "value" : "values"} removed`;

const localDateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric"
});

const localDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit"
});

export const formatLocalDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return value;
  }

  return localDateFormatter.format(new Date(year, month - 1, day));
};

export const formatLocalDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return localDateTimeFormatter.format(date);
};

export const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.ceil(bytes / 1024)} KB`;
  }
  return `${bytes} bytes`;
};

export const filenameFromContentDisposition = (header: string | null, fallback: string) => {
  const match = header?.match(/filename="([^"]+)"/i);
  return match?.[1] ?? fallback;
};

export const fitLabel = (score: number) => {
  if (score >= 80) {
    return "Strong match";
  }
  if (score >= 60) {
    return "Moderate match";
  }
  return "Low match";
};

export const fitTone = (score: number): "success" | "warning" | "danger" => {
  if (score >= 80) {
    return "success";
  }
  if (score >= 60) {
    return "warning";
  }
  return "danger";
};

export const evidenceRelevanceLabel = (score: number) => {
  if (score >= 0.65) {
    return "Evidence relevance: high";
  }
  if (score >= 0.35) {
    return "Evidence relevance: medium";
  }
  return "Evidence relevance: low";
};
