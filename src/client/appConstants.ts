import type { ActiveView, ThemeName } from "./appTypes";

export const authStorageKey = "roos-token";
export const themeStorageKey = "roos-theme";
export const appSlogan = "We're not here to put socks on centipedes, mate!";
export const listPageSize = 10;

export const defaultAuthenticatedView: ActiveView = "applications";
export const adminOnlyViews = new Set<ActiveView>(["adminJobs", "adminUsers", "systemHealth", "adminSettings"]);

export const passwordRuleLabels = {
  length: "At least 12 characters",
  lowercase: "One lowercase letter",
  uppercase: "One uppercase letter",
  number: "One number"
};

export const routeForView: Record<ActiveView, string> = {
  analysis: "/analysis",
  applications: "/applications",
  jobs: "/jobs",
  profile: "/profile",
  adminJobs: "/admin/jobs",
  adminUsers: "/admin/users",
  systemHealth: "/admin/health",
  adminSettings: "/admin/settings"
};

export const themeLabels: Record<ThemeName, string> = {
  "default-light": "Default",
  "default-dark": "Default Dark",
  "icy-blue-light": "Icy Blue Light",
  "icy-blue-dark": "Icy Blue Dark",
  "crimson-lit-light": "Crimson Lit Light",
  "crimson-lit-dark": "Crimson Lit Dark"
};

export const themeOrder: ThemeName[] = [
  "default-light",
  "default-dark",
  "icy-blue-light",
  "icy-blue-dark",
  "crimson-lit-light",
  "crimson-lit-dark"
];
