export const toPgVectorLiteral = (embedding: number[]): string => {
  if (embedding.length === 0) {
    throw new Error("Embedding vector cannot be empty.");
  }

  if (!embedding.every(Number.isFinite)) {
    throw new Error("Embedding vector contains non-finite values.");
  }

  return `[${embedding.join(",")}]`;
};
