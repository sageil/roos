import { describe, expect, it } from "vitest";
import { providerApiKey } from "../../src/server/config.js";

describe("providerApiKey", () => {
  it("returns the explicit API key when present", () => {
    expect(providerApiKey("sk-test", undefined)).toBe("sk-test");
  });

  it("uses a placeholder key for OpenAI-compatible local providers", () => {
    expect(providerApiKey(undefined, "http://127.0.0.1:1234/v1")).toBe("not-needed");
  });

  it("throws when neither API key nor compatible base URL is configured", () => {
    expect(() => providerApiKey(undefined, undefined)).toThrow("Missing OPENAI_API_KEY");
  });
});
