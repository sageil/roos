import { config } from "./config.js";
import { createEmbeddingClient } from "./openaiClients.js";

export const cosineSimilarity = (left: number[], right: number[]): number => {
  const length = Math.min(left.length, right.length);
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
};

export const createEmbeddings = async (inputs: string[]): Promise<number[][]> => {
  const client = createEmbeddingClient();
  const request: {
    model: string;
    input: string[];
    dimensions?: number;
  } = {
    model: config.embeddingModel,
    input: inputs
  };

  if (config.embeddingDimensions) {
    request.dimensions = config.embeddingDimensions;
  }

  const response = await client.embeddings.create(request);
  return response.data.map((item) => item.embedding);
};
