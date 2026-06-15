import type { AppSettings } from "../shared/types.js";
import { getEffectiveAppSettings } from "./appSettingsStore.js";
import { createEmbeddingClient } from "./openaiClients.js";

export const cosineSimilarity = (left: number[], right: number[]): number => {
  if (
    left.length === 0 ||
    right.length === 0 ||
    !left.every(Number.isFinite) ||
    !right.every(Number.isFinite)
  ) {
    return 0;
  }

  const sharedLength = Math.min(left.length, right.length);
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < sharedLength; index += 1) {
    dot += left[index] * right[index];
  }

  for (const value of left) {
    leftMagnitude += value * value;
  }

  for (const value of right) {
    rightMagnitude += value * value;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
};

export const createEmbeddings = async (
  inputs: string[],
  settings?: AppSettings
): Promise<number[][]> => {
  const effectiveSettings = settings ?? await getEffectiveAppSettings();
  const client = createEmbeddingClient(effectiveSettings);
  const request: {
    model: string;
    input: string[];
    dimensions?: number;
  } = {
    model: effectiveSettings.embeddingModel,
    input: inputs
  };

  if (effectiveSettings.embeddingDimensions) {
    request.dimensions = effectiveSettings.embeddingDimensions;
  }

  const response = await client.embeddings.create(request);
  return response.data.map((item) => item.embedding);
};
