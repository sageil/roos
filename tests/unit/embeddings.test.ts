import { describe, expect, it } from "vitest";
import { cosineSimilarity } from "../../src/server/embeddings.js";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it("returns 0 when either vector has no magnitude", () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
    expect(cosineSimilarity([1, 2], [0, 0])).toBe(0);
  });

  it("includes unmatched dimensions in vector magnitude", () => {
    expect(cosineSimilarity([1, 0, 100], [1, 0])).toBeCloseTo(0.01, 2);
  });

  it("returns 0 for invalid vectors", () => {
    expect(cosineSimilarity([], [1, 2])).toBe(0);
    expect(cosineSimilarity([Number.NaN], [1])).toBe(0);
  });
});
