import OpenAI from "openai";
import type { AppSettings } from "../shared/types.js";
import { providerApiKey } from "./config.js";

export const createLlmClient = (settings: AppSettings) =>
  new OpenAI({
    apiKey: providerApiKey(settings.openaiApiKey, settings.openaiBaseUrl),
    baseURL: settings.openaiBaseUrl
  });

export const createEmbeddingClient = (settings: AppSettings) =>
  new OpenAI({
    apiKey: providerApiKey(settings.embeddingApiKey, settings.embeddingBaseUrl),
    baseURL: settings.embeddingBaseUrl
  });
