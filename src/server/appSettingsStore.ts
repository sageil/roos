import type { AppSettings, PublicAppSettings } from "../shared/types.js";
import { config } from "./config.js";
import { queryPostgres } from "./database.js";
import { queries } from "./sql.js";

type AppSettingsRow = {
  openai_api_key: string | null;
  openai_base_url: string | null;
  llm_model: string | null;
  llm_api_style: "responses" | "chat" | null;
  embedding_api_key: string | null;
  embedding_base_url: string | null;
  embedding_model: string | null;
  embedding_dimensions: number | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: boolean | null;
  smtp_user: string | null;
  smtp_pass: string | null;
  email_from: string | null;
  email_from_name: string | null;
  updated_at: string | null;
};

export type AppSettingsUpdate = Partial<{
  openaiApiKey: string | null;
  openaiBaseUrl: string | null;
  llmModel: string | null;
  llmApiStyle: "responses" | "chat" | null;
  embeddingApiKey: string | null;
  embeddingBaseUrl: string | null;
  embeddingModel: string | null;
  embeddingDimensions: number | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean | null;
  smtpUser: string | null;
  smtpPass: string | null;
  emailFrom: string | null;
  emailFromName: string | null;
}>;

const emptyToUndefined = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const nullable = (value: string | null | undefined) => emptyToUndefined(value) ?? null;

const envSettings = (): AppSettings => ({
  openaiApiKey: config.openaiApiKey,
  openaiBaseUrl: config.openaiBaseUrl,
  llmModel: config.llmModel,
  llmApiStyle: config.llmApiStyle,
  embeddingApiKey: config.embeddingApiKey,
  embeddingBaseUrl: config.embeddingBaseUrl,
  embeddingModel: config.embeddingModel,
  embeddingDimensions: config.embeddingDimensions,
  smtpHost: config.email.smtpHost,
  smtpPort: config.email.smtpPort,
  smtpSecure: config.email.smtpSecure,
  smtpUser: config.email.smtpUser,
  smtpPass: config.email.smtpPass,
  emailFrom: config.email.from,
  emailFromName: config.email.fromName
});

const effectiveFromRow = (row?: AppSettingsRow): AppSettings => {
  const fallback = envSettings();
  return {
    openaiApiKey: emptyToUndefined(row?.openai_api_key) ?? fallback.openaiApiKey,
    openaiBaseUrl: emptyToUndefined(row?.openai_base_url) ?? fallback.openaiBaseUrl,
    llmModel: emptyToUndefined(row?.llm_model) ?? fallback.llmModel,
    llmApiStyle: row?.llm_api_style ?? fallback.llmApiStyle,
    embeddingApiKey: emptyToUndefined(row?.embedding_api_key) ?? fallback.embeddingApiKey,
    embeddingBaseUrl: emptyToUndefined(row?.embedding_base_url) ?? fallback.embeddingBaseUrl,
    embeddingModel: emptyToUndefined(row?.embedding_model) ?? fallback.embeddingModel,
    embeddingDimensions: row?.embedding_dimensions ?? fallback.embeddingDimensions,
    smtpHost: emptyToUndefined(row?.smtp_host) ?? fallback.smtpHost,
    smtpPort: row?.smtp_port ?? fallback.smtpPort,
    smtpSecure: row?.smtp_secure ?? fallback.smtpSecure,
    smtpUser: emptyToUndefined(row?.smtp_user) ?? fallback.smtpUser,
    smtpPass: emptyToUndefined(row?.smtp_pass) ?? fallback.smtpPass,
    emailFrom: emptyToUndefined(row?.email_from) ?? fallback.emailFrom,
    emailFromName: emptyToUndefined(row?.email_from_name) ?? fallback.emailFromName
  };
};

const publicSettings = (settings: AppSettings, updatedAt?: string): PublicAppSettings => ({
  openaiBaseUrl: settings.openaiBaseUrl,
  llmModel: settings.llmModel,
  llmApiStyle: settings.llmApiStyle,
  embeddingBaseUrl: settings.embeddingBaseUrl,
  embeddingModel: settings.embeddingModel,
  embeddingDimensions: settings.embeddingDimensions,
  smtpHost: settings.smtpHost,
  smtpPort: settings.smtpPort,
  smtpSecure: settings.smtpSecure,
  smtpUser: settings.smtpUser,
  emailFrom: settings.emailFrom,
  emailFromName: settings.emailFromName,
  openaiApiKeyConfigured: Boolean(settings.openaiApiKey),
  embeddingApiKeyConfigured: Boolean(settings.embeddingApiKey),
  smtpPassConfigured: Boolean(settings.smtpPass),
  updatedAt
});

const getSettingsRow = async () => {
  try {
    const result = await queryPostgres<AppSettingsRow>(queries.appSettings.get);
    return result.rows[0];
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "42P01") {
      return undefined;
    }
    throw error;
  }
};

export const getEffectiveAppSettings = async (): Promise<AppSettings> =>
  effectiveFromRow(await getSettingsRow());

export const getPublicAppSettings = async (): Promise<PublicAppSettings> => {
  const row = await getSettingsRow();
  return publicSettings(effectiveFromRow(row), row?.updated_at ?? undefined);
};

export const updateAppSettings = async (update: AppSettingsUpdate): Promise<PublicAppSettings> => {
  const current = await getSettingsRow();
  const keep = <K extends keyof AppSettingsUpdate>(key: K, currentValue: string | null | undefined) =>
    Object.prototype.hasOwnProperty.call(update, key) ? nullable(update[key] as string | null | undefined) : nullable(currentValue);
  const keepSecret = <K extends keyof AppSettingsUpdate>(key: K, currentValue: string | null | undefined) => {
    if (!Object.prototype.hasOwnProperty.call(update, key)) {
      return nullable(currentValue);
    }
    return nullable(update[key] as string | null | undefined) ?? nullable(currentValue);
  };

  const result = await queryPostgres<AppSettingsRow>(queries.appSettings.upsert, [
    keepSecret("openaiApiKey", current?.openai_api_key),
    keep("openaiBaseUrl", current?.openai_base_url),
    keep("llmModel", current?.llm_model),
    Object.prototype.hasOwnProperty.call(update, "llmApiStyle") ? update.llmApiStyle ?? null : current?.llm_api_style ?? null,
    keepSecret("embeddingApiKey", current?.embedding_api_key),
    keep("embeddingBaseUrl", current?.embedding_base_url),
    keep("embeddingModel", current?.embedding_model),
    Object.prototype.hasOwnProperty.call(update, "embeddingDimensions") ? update.embeddingDimensions ?? null : current?.embedding_dimensions ?? null,
    keep("smtpHost", current?.smtp_host),
    Object.prototype.hasOwnProperty.call(update, "smtpPort") ? update.smtpPort ?? null : current?.smtp_port ?? null,
    Object.prototype.hasOwnProperty.call(update, "smtpSecure") ? update.smtpSecure ?? null : current?.smtp_secure ?? null,
    keep("smtpUser", current?.smtp_user),
    keepSecret("smtpPass", current?.smtp_pass),
    keep("emailFrom", current?.email_from),
    keep("emailFromName", current?.email_from_name)
  ]);
  const row = result.rows[0];
  return publicSettings(effectiveFromRow(row), row?.updated_at ?? undefined);
};
