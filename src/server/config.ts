import "dotenv/config";
import { parseCidr, type CidrRange } from "./ipCidr.js";

const optionalNumber = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

// Parses a comma-separated list of IPs/CIDRs from an env var. Unset or blank
// means no entries. Throws at load time, naming the variable but never echoing
// the whole list, so a bad value stops startup with a readable message.
export const parseIpRuleList = (name: string, value: string | undefined): CidrRange[] => {
  if (value === undefined || value.trim() === "") {
    return [];
  }

  return value.split(",").map((entry) => {
    if (entry.trim() === "") {
      throw new Error(
        `Invalid ${name}: contains an empty entry. Remove leading, trailing or doubled commas.`
      );
    }

    try {
      return parseCidr(entry);
    } catch (error) {
      throw new Error(`Invalid ${name}: ${(error as Error).message}`);
    }
  });
};

export const config = {
  port: optionalNumber(process.env.PORT) ?? 8787,
  host: process.env.HOST || "127.0.0.1",
  databaseUrl:
    process.env.DATABASE_URL ||
    `postgres://${process.env.APP_DB_USER || "roos_app"}:${process.env.APP_DB_PASSWORD || "roos"}@127.0.0.1:5432/roos`,
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiBaseUrl: process.env.OPENAI_BASE_URL || undefined,
  llmModel: process.env.LLM_MODEL || "gpt-5.5",
  llmApiStyle: process.env.LLM_API_STYLE === "chat" ? "chat" : "responses",
  embeddingApiKey: process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY,
  embeddingBaseUrl: process.env.EMBEDDING_BASE_URL || process.env.OPENAI_BASE_URL || undefined,
  embeddingModel: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
  embeddingDimensions: optionalNumber(process.env.EMBEDDING_DIMENSIONS) ?? 768,
  appInstanceName: process.env.APP_INSTANCE_NAME || process.env.HOSTNAME || "local",
  appInstanceUrls: process.env.APP_INSTANCE_URLS || "",
  // Client IP filtering. Empty allowlist = allow all; deny always wins.
  ipAllowlist: parseIpRuleList("IP_ALLOWLIST", process.env.IP_ALLOWLIST),
  ipDenylist: parseIpRuleList("IP_DENYLIST", process.env.IP_DENYLIST),
  // Only requests whose socket peer is in these ranges may supply X-Forwarded-For.
  trustedProxies: parseIpRuleList("TRUSTED_PROXIES", process.env.TRUSTED_PROXIES),
  maxUploadBytes: 8 * 1024 * 1024,
  sessionTtlSeconds: optionalNumber(process.env.SESSION_TTL_SECONDS) ?? 60 * 60 * 24 * 7,
  adminName: process.env.ADMIN_NAME || "Roos Admin",
  adminEmail: process.env.ADMIN_EMAIL || "admin@example.com.au",
  adminPassword: process.env.ADMIN_PASSWORD,
  email: {
    smtpHost: process.env.SMTP_HOST,
    smtpPort: optionalNumber(process.env.SMTP_PORT) ?? 587,
    smtpSecure: process.env.SMTP_SECURE === "true",
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    fromName: process.env.EMAIL_FROM_NAME || process.env.ADMIN_NAME || "Roos Admin"
  }
} as const;

export const providerApiKey = (apiKey: string | undefined, baseUrl: string | undefined): string => {
  if (apiKey) {
    return apiKey;
  }

  if (baseUrl) {
    return "not-needed";
  }

  throw new Error("Missing OPENAI_API_KEY. Set it in .env or configure an OpenAI-compatible base URL.");
};
