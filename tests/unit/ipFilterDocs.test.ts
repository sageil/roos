import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const variables = ["IP_ALLOWLIST", "IP_DENYLIST", "TRUSTED_PROXIES"];

describe("IP filtering documentation", () => {
  const architecture = read("docs/architecture.md");
  const readme = read("README.md");
  const envExample = read(".env.example");

  it.each(variables)("documents %s in README and architecture", (name) => {
    expect(readme).toContain(`\`${name}\``);
    expect(architecture).toContain(name);
    expect(envExample).toContain(`${name}=`);
  });

  it("states denylist precedence over allowlist in architecture", () => {
    expect(architecture).toMatch(/denylist is checked first and always wins/i);
    expect(architecture).toMatch(/empty allowlist admits every client that is not denied/i);
  });

  it("documents the 403 behaviour", () => {
    expect(architecture).toContain("403");
    expect(readme).toContain("403");
  });

  it("documents the trusted proxy chain caveat", () => {
    expect(architecture).toMatch(/only the configured proxy chain|configured proxy chain/i);
  });

  it("includes an example configuration", () => {
    expect(architecture).toMatch(/IP_ALLOWLIST=\S+/);
    expect(readme).toMatch(/IP_DENYLIST=\S+/);
  });

  it("contains no concrete secret values in the IP filtering sections", () => {
    const sections = [architecture, readme]
      .flatMap((text) => text.split(/\n(?=#)/))
      .filter((section) => /IP_ALLOWLIST|IP_DENYLIST|TRUSTED_PROXIES|IP filtering/i.test(section))
      .join("\n");
    expect(sections).not.toMatch(/sk-[A-Za-z0-9]{8,}/);
    expect(sections).not.toMatch(/PASSWORD=\S+/);
  });
});
