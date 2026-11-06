import { afterEach, describe, expect, it, vi } from "vitest";
import { parseIpRuleList, providerApiKey } from "../../src/server/config.js";

const ipEnvNames = ["IP_ALLOWLIST", "IP_DENYLIST", "TRUSTED_PROXIES"] as const;

const loadConfigWith = async (env: Partial<Record<(typeof ipEnvNames)[number], string>>) => {
  for (const name of ipEnvNames) {
    // Unset the variable unless the test provides it, so the host env cannot leak in.
    delete process.env[name];
    if (env[name] !== undefined) {
      vi.stubEnv(name, env[name]);
    }
  }
  vi.resetModules();
  return (await import("../../src/server/config.js")).config;
};

afterEach(() => {
  vi.unstubAllEnvs();
});

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

  it("defaults embedding dimensions to the pgvector profile schema size", async () => {
    vi.stubEnv("EMBEDDING_DIMENSIONS", "");
    vi.resetModules();

    const { config } = await import("../../src/server/config.js");

    expect(config.embeddingDimensions).toBe(768);
  });

  it("allows embedding dimensions to be overridden", async () => {
    vi.stubEnv("EMBEDDING_DIMENSIONS", "384");
    vi.resetModules();

    const { config } = await import("../../src/server/config.js");

    expect(config.embeddingDimensions).toBe(384);
  });
});

describe("IP filtering configuration", () => {
  it("treats unset variables as no filtering", async () => {
    const config = await loadConfigWith({});

    expect(config.ipAllowlist).toEqual([]);
    expect(config.ipDenylist).toEqual([]);
    expect(config.trustedProxies).toEqual([]);
  });

  it("treats blank variables as no filtering", async () => {
    const config = await loadConfigWith({ IP_ALLOWLIST: "", IP_DENYLIST: "   ", TRUSTED_PROXIES: "" });

    expect(config.ipAllowlist).toEqual([]);
    expect(config.ipDenylist).toEqual([]);
    expect(config.trustedProxies).toEqual([]);
  });

  it("parses lists into normalized rules", async () => {
    const config = await loadConfigWith({
      IP_ALLOWLIST: " 10.1.2.3/8 , 203.0.113.9 ,2001:db8::/32",
      IP_DENYLIST: "::ffff:192.0.2.0/120",
      TRUSTED_PROXIES: "172.16.0.0/12, fc00::/7"
    });

    expect(config.ipAllowlist).toEqual([
      { family: 4, bytes: [10, 0, 0, 0], prefixLength: 8 },
      { family: 4, bytes: [203, 0, 113, 9], prefixLength: 32 },
      { family: 6, bytes: [0x20, 0x01, 0x0d, 0xb8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], prefixLength: 32 }
    ]);
    expect(config.ipDenylist).toEqual([{ family: 4, bytes: [192, 0, 2, 0], prefixLength: 24 }]);
    expect(config.trustedProxies).toEqual([
      { family: 4, bytes: [172, 16, 0, 0], prefixLength: 12 },
      { family: 6, bytes: [0xfc, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], prefixLength: 7 }
    ]);
  });

  it("fails startup on a malformed allowlist entry, naming the variable", async () => {
    await expect(loadConfigWith({ IP_ALLOWLIST: "10.0.0.0/8,10.0.0.0/33" })).rejects.toThrow(
      /^Invalid IP_ALLOWLIST: Invalid CIDR "10\.0\.0\.0\/33"/
    );
  });

  it("fails startup on a malformed denylist entry", async () => {
    await expect(loadConfigWith({ IP_DENYLIST: "not-an-ip" })).rejects.toThrow(/Invalid IP_DENYLIST/);
  });

  it("fails startup on a malformed trusted proxy entry", async () => {
    await expect(loadConfigWith({ TRUSTED_PROXIES: "10.0.0.1, 999.0.0.1" })).rejects.toThrow(
      /Invalid TRUSTED_PROXIES/
    );
  });

  it("fails startup on empty entries from stray commas", async () => {
    await expect(loadConfigWith({ IP_DENYLIST: "10.0.0.1,," })).rejects.toThrow(
      /^Invalid IP_DENYLIST: contains an empty entry/
    );
    await expect(loadConfigWith({ IP_ALLOWLIST: ",10.0.0.1" })).rejects.toThrow(/Invalid IP_ALLOWLIST/);
  });

  it("does not echo the full list in error messages", async () => {
    const list = "10.0.0.1,198.51.100.7,bogus-entry-value";

    const error = await loadConfigWith({ IP_ALLOWLIST: list }).catch((caught: unknown) => caught);

    expect((error as Error).message).toContain("IP_ALLOWLIST");
    expect((error as Error).message).not.toContain(list);
    expect((error as Error).message).not.toContain("198.51.100.7");
  });
});

describe("parseIpRuleList", () => {
  it("returns an empty list for undefined or blank values", () => {
    expect(parseIpRuleList("X", undefined)).toEqual([]);
    expect(parseIpRuleList("X", "")).toEqual([]);
    expect(parseIpRuleList("X", " \t ")).toEqual([]);
  });

  it("rejects an entry that is only whitespace between commas", () => {
    expect(() => parseIpRuleList("X", "10.0.0.1, ,10.0.0.2")).toThrow(/^Invalid X: contains an empty entry/);
  });
});
