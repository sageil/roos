export type Status = "idle" | "loading" | "success" | "error";

export type ActiveView = "analysis" | "applications" | "jobs" | "profile" | "adminJobs" | "adminUsers" | "systemHealth" | "adminSettings";

export type ThemeName =
  | "default-light"
  | "default-dark"
  | "icy-blue-light"
  | "icy-blue-dark"
  | "crimson-lit-light"
  | "crimson-lit-dark";

export type PrivacyRedactionForm = {
  name: string;
  emails: string;
  phones: string;
  addressLines: string;
  links: string;
};
