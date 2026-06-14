import OpenAI from "openai";
import { config, providerApiKey } from "./config.js";

export const createLlmClient = () =>
  new OpenAI({
    apiKey: providerApiKey(config.openaiApiKey, config.openaiBaseUrl),
    baseURL: config.openaiBaseUrl
  });

export const createEmbeddingClient = () =>
  new OpenAI({
    apiKey: providerApiKey(config.embeddingApiKey, config.embeddingBaseUrl),
    baseURL: config.embeddingBaseUrl
  });
