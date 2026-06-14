import { describe, expect, it } from "vitest";
import { chunkResumeText } from "../../src/server/chunking.js";

describe("chunkResumeText", () => {
  it("returns numbered chunks from separated resume sections", () => {
    const chunks = chunkResumeText("SUMMARY\n\nExperienced engineer.\n\nSKILLS\n\nTypeScript and PostgreSQL.");

    expect(chunks).toEqual([
      {
        id: 1,
        text: "SUMMARY\n\nExperienced engineer.\n\nSKILLS\n\nTypeScript and PostgreSQL."
      }
    ]);
  });

  it("splits long blocks with overlap and trims chunk text", () => {
    const longText = "A".repeat(3200);
    const chunks = chunkResumeText(longText);

    expect(chunks).toHaveLength(3);
    expect(chunks.map((chunk) => chunk.id)).toEqual([1, 2, 3]);
    expect(chunks[0].text).toHaveLength(1400);
    expect(chunks[1].text).toHaveLength(1400);
    expect(chunks[2].text.length).toBeGreaterThan(0);
  });

  it("ignores empty whitespace-only input", () => {
    expect(chunkResumeText("\n\n   \n")).toEqual([]);
  });
});
