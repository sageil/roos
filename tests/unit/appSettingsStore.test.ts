import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryPostgres } = vi.hoisted(() => ({
  queryPostgres: vi.fn()
}));

vi.mock("../../src/server/config.js", () => ({
  config: {
    openaiApiKey: "env-openai-key",
    openaiBaseUrl: "https://env-llm.example/v1",
    llmModel: "env-llm",
    llmApiStyle: "responses",
    embeddingApiKey: "env-embedding-key",
    embeddingBaseUrl: "https://env-embedding.example/v1",
    embeddingModel: "env-embedding",
    embeddingDimensions: 768,
    email: {
      smtpHost: "smtp.env.example",
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: "smtp-env-user",
      smtpPass: "smtp-env-pass",
      from: "env@example.com",
      fromName: "Env Admin"
    }
  }
}));

vi.mock("../../src/server/database.js", () => ({
  queryPostgres
}));

vi.mock("../../src/server/sql.js", () => ({
  queries: {
    appSettings: {
      get: "appSettings.get",
      upsert: "appSettings.upsert"
    }
  }
}));

import {
  getEffectiveAppSettings,
  getPublicAppSettings,
  updateAppSettings
} from "../../src/server/appSettingsStore.js";

describe("appSettingsStore", () => {
  beforeEach(() => {
    queryPostgres.mockReset();
  });

  it("merges stored settings over environment defaults", async () => {
    queryPostgres.mockResolvedValueOnce({
      rows: [{
        openai_api_key: null,
        openai_base_url: "https://db-llm.example/v1",
        llm_model: "db-llm",
        llm_api_style: "chat",
        embedding_api_key: "db-embedding-key",
        embedding_base_url: null,
        embedding_model: "db-embedding",
        embedding_dimensions: 1536,
        smtp_host: "smtp.db.example",
        smtp_port: 465,
        smtp_secure: true,
        smtp_user: null,
        smtp_pass: null,
        email_from: "db@example.com",
        email_from_name: null,
        updated_at: "2026-06-15T12:00:00.000Z"
      }]
    });

    await expect(getEffectiveAppSettings()).resolves.toEqual({
      openaiApiKey: "env-openai-key",
      openaiBaseUrl: "https://db-llm.example/v1",
      llmModel: "db-llm",
      llmApiStyle: "chat",
      embeddingApiKey: "db-embedding-key",
      embeddingBaseUrl: "https://env-embedding.example/v1",
      embeddingModel: "db-embedding",
      embeddingDimensions: 1536,
      smtpHost: "smtp.db.example",
      smtpPort: 465,
      smtpSecure: true,
      smtpUser: "smtp-env-user",
      smtpPass: "smtp-env-pass",
      emailFrom: "db@example.com",
      emailFromName: "Env Admin"
    });
  });

  it("uses environment defaults when app_settings has not been created yet", async () => {
    const missingTableError = new Error("relation does not exist") as Error & { code: string };
    missingTableError.code = "42P01";
    queryPostgres.mockRejectedValueOnce(missingTableError);

    await expect(getPublicAppSettings()).resolves.toMatchObject({
      openaiBaseUrl: "https://env-llm.example/v1",
      llmModel: "env-llm",
      llmApiStyle: "responses",
      embeddingBaseUrl: "https://env-embedding.example/v1",
      embeddingModel: "env-embedding",
      embeddingDimensions: 768,
      smtpHost: "smtp.env.example",
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: "smtp-env-user",
      emailFrom: "env@example.com",
      emailFromName: "Env Admin",
      openaiApiKeyConfigured: true,
      embeddingApiKeyConfigured: true,
      smtpPassConfigured: true
    });
  });

  it("preserves secrets on blank updates and clears non-secrets back to env fallback", async () => {
    queryPostgres
      .mockResolvedValueOnce({
        rows: [{
          openai_api_key: "current-openai-key",
          openai_base_url: "https://db-llm.example/v1",
          llm_model: "db-llm",
          llm_api_style: "chat",
          embedding_api_key: "current-embedding-key",
          embedding_base_url: "https://db-embedding.example/v1",
          embedding_model: "db-embedding",
          embedding_dimensions: 1536,
          smtp_host: "smtp.db.example",
          smtp_port: 465,
          smtp_secure: true,
          smtp_user: "current-smtp-user",
          smtp_pass: "current-smtp-pass",
          email_from: "db@example.com",
          email_from_name: "DB Admin",
          updated_at: "2026-06-15T12:00:00.000Z"
        }]
      })
      .mockResolvedValueOnce({
        rows: [{
          openai_api_key: "current-openai-key",
          openai_base_url: null,
          llm_model: "new-llm",
          llm_api_style: "chat",
          embedding_api_key: "current-embedding-key",
          embedding_base_url: "https://db-embedding.example/v1",
          embedding_model: "db-embedding",
          embedding_dimensions: 1536,
          smtp_host: "smtp.db.example",
          smtp_port: 465,
          smtp_secure: true,
          smtp_user: "current-smtp-user",
          smtp_pass: "current-smtp-pass",
          email_from: "db@example.com",
          email_from_name: "DB Admin",
          updated_at: "2026-06-15T12:30:00.000Z"
        }]
      });

    await expect(updateAppSettings({
      openaiApiKey: "   ",
      openaiBaseUrl: "",
      llmModel: "new-llm",
      smtpPass: ""
    })).resolves.toMatchObject({
      openaiBaseUrl: "https://env-llm.example/v1",
      llmModel: "new-llm",
      openaiApiKeyConfigured: true,
      smtpPassConfigured: true
    });

    expect(queryPostgres).toHaveBeenNthCalledWith(2, "appSettings.upsert", [
      "current-openai-key",
      null,
      "new-llm",
      "chat",
      "current-embedding-key",
      "https://db-embedding.example/v1",
      "db-embedding",
      1536,
      "smtp.db.example",
      465,
      true,
      "current-smtp-user",
      "current-smtp-pass",
      "db@example.com",
      "DB Admin"
    ]);
  });
});
