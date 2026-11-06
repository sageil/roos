import type { AddressInfo } from "node:net";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createIpFilter, isClientAllowed, resolveClientAddress } from "../../src/server/ipFilter.js";
import { parseCidr, parseCidrList } from "../../src/server/ipCidr.js";

describe("resolveClientAddress", () => {
  const trusted = parseCidrList("10.0.0.0/8,127.0.0.1/32");

  it("uses the socket address when no proxies are trusted", () => {
    expect(resolveClientAddress("203.0.113.9", "198.51.100.1", [])).toBe("203.0.113.9");
  });

  it("ignores X-Forwarded-For when the socket peer is not a trusted proxy", () => {
    expect(resolveClientAddress("203.0.113.9", "198.51.100.1", trusted)).toBe("203.0.113.9");
  });

  it("uses the socket address when a trusted peer sends no forwarded header", () => {
    expect(resolveClientAddress("10.1.2.3", undefined, trusted)).toBe("10.1.2.3");
  });

  it("takes the rightmost untrusted hop from a trusted peer", () => {
    expect(resolveClientAddress("127.0.0.1", "198.51.100.7, 10.0.0.4", trusted)).toBe("198.51.100.7");
  });

  it("does not let a spoofed leftmost entry win over the rightmost untrusted hop", () => {
    expect(resolveClientAddress("127.0.0.1", "10.9.9.9, 198.51.100.7", trusted)).toBe("198.51.100.7");
  });

  it("returns the leftmost hop when every hop is trusted", () => {
    expect(resolveClientAddress("127.0.0.1", "10.0.0.8, 10.0.0.4", trusted)).toBe("10.0.0.8");
  });

  it("tolerates whitespace around forwarded entries", () => {
    expect(resolveClientAddress("127.0.0.1", "  198.51.100.7  ,10.0.0.4 ", trusted)).toBe("198.51.100.7");
  });

  it("returns undefined when a forwarded hop is not an IP address", () => {
    expect(resolveClientAddress("127.0.0.1", "198.51.100.7, not-an-ip", trusted)).toBeUndefined();
  });

  it("returns undefined when a forwarded entry is empty", () => {
    expect(resolveClientAddress("127.0.0.1", "198.51.100.7,", trusted)).toBeUndefined();
  });

  it("returns undefined when there is no socket address", () => {
    expect(resolveClientAddress(undefined, undefined, trusted)).toBeUndefined();
  });

  it("matches IPv6 trusted proxies and IPv6 clients", () => {
    const ipv6Trusted = parseCidrList("fc00::/7");
    expect(resolveClientAddress("fd00::5", "2001:db8::7", ipv6Trusted)).toBe("2001:db8::7");
  });

  it("treats a dual-stack mapped socket as its IPv4 address", () => {
    expect(resolveClientAddress("::ffff:127.0.0.1", "198.51.100.7", trusted)).toBe("198.51.100.7");
  });
});

describe("isClientAllowed", () => {
  it("allows everything when no rules exist", () => {
    expect(isClientAllowed("203.0.113.9", { allowlist: [], denylist: [] })).toBe(true);
  });

  it("denies a denylisted client", () => {
    expect(isClientAllowed("203.0.113.9", { allowlist: [], denylist: parseCidrList("203.0.113.0/24") })).toBe(false);
  });

  it("lets the denylist win over a matching allowlist entry", () => {
    expect(
      isClientAllowed("203.0.113.9", {
        allowlist: parseCidrList("203.0.113.0/24"),
        denylist: parseCidrList("203.0.113.9")
      })
    ).toBe(false);
  });

  it("denies clients outside a non-empty allowlist", () => {
    expect(isClientAllowed("198.51.100.1", { allowlist: parseCidrList("203.0.113.0/24"), denylist: [] })).toBe(false);
  });

  it("allows clients inside a non-empty allowlist", () => {
    expect(isClientAllowed("203.0.113.200", { allowlist: parseCidrList("203.0.113.0/24"), denylist: [] })).toBe(true);
  });

  it("denies an unidentifiable client when an allowlist exists", () => {
    expect(isClientAllowed(undefined, { allowlist: parseCidrList("203.0.113.0/24"), denylist: [] })).toBe(false);
  });

  it("denies an unidentifiable client when only a denylist exists", () => {
    expect(isClientAllowed(undefined, { allowlist: [], denylist: parseCidrList("203.0.113.0/24") })).toBe(false);
  });

  it("matches IPv6 ranges", () => {
    const allowlist = [parseCidr("2001:db8::/32")];
    expect(isClientAllowed("2001:db8:1::5", { allowlist, denylist: [] })).toBe(true);
    expect(isClientAllowed("2001:db9::5", { allowlist, denylist: [] })).toBe(false);
  });
});

describe("createIpFilter middleware", () => {
  let server: import("node:http").Server;
  let baseUrl: string;
  let handlerCalls: number;

  const startApp = async (options: Parameters<typeof createIpFilter>[0]) => {
    const app = express();
    app.use(createIpFilter(options));
    app.get("/api/data", (_request, response) => {
      handlerCalls += 1;
      response.json({ ok: true });
    });
    app.get("/api/health", (_request, response) => {
      handlerCalls += 1;
      response.json({ ok: true });
    });
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  };

  beforeEach(() => {
    handlerCalls = 0;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("returns 403 for a denylisted client and never calls the handler", async () => {
    await startApp({ allowlist: [], denylist: parseCidrList("127.0.0.0/8"), trustedProxies: [] });

    const response = await fetch(`${baseUrl}/api/data`);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden." });
    expect(handlerCalls).toBe(0);
  });

  it("returns 403 for clients outside a non-empty allowlist", async () => {
    await startApp({ allowlist: parseCidrList("203.0.113.0/24"), denylist: [], trustedProxies: [] });

    const response = await fetch(`${baseUrl}/api/data`);

    expect(response.status).toBe(403);
    expect(handlerCalls).toBe(0);
  });

  it("ignores a spoofed X-Forwarded-For from an untrusted peer", async () => {
    // The socket is 127.0.0.1, which is denylisted. Claiming to be an allowlisted
    // address via the header must not get the request through.
    await startApp({
      allowlist: parseCidrList("203.0.113.0/24"),
      denylist: parseCidrList("127.0.0.0/8"),
      trustedProxies: parseCidrList("10.0.0.0/8")
    });

    const response = await fetch(`${baseUrl}/api/data`, {
      headers: { "X-Forwarded-For": "203.0.113.50" }
    });

    expect(response.status).toBe(403);
    expect(handlerCalls).toBe(0);
  });

  it("honours the forwarded client address from a trusted proxy", async () => {
    await startApp({
      allowlist: parseCidrList("203.0.113.0/24"),
      denylist: [],
      trustedProxies: parseCidrList("127.0.0.1/32")
    });

    const allowed = await fetch(`${baseUrl}/api/data`, {
      headers: { "X-Forwarded-For": "203.0.113.50" }
    });
    const blocked = await fetch(`${baseUrl}/api/data`, {
      headers: { "X-Forwarded-For": "198.51.100.50" }
    });

    expect(allowed.status).toBe(200);
    expect(blocked.status).toBe(403);
    expect(handlerCalls).toBe(1);
  });

  it("denies a trusted proxy's forwarded client when that client is denylisted", async () => {
    await startApp({
      allowlist: [],
      denylist: parseCidrList("198.51.100.0/24"),
      trustedProxies: parseCidrList("127.0.0.1/32")
    });

    const response = await fetch(`${baseUrl}/api/data`, {
      headers: { "X-Forwarded-For": "198.51.100.50" }
    });

    expect(response.status).toBe(403);
  });

  it("fails closed when a trusted proxy forwards a malformed client address", async () => {
    await startApp({
      allowlist: [],
      denylist: parseCidrList("198.51.100.0/24"),
      trustedProxies: parseCidrList("127.0.0.1/32")
    });

    const response = await fetch(`${baseUrl}/api/data`, {
      headers: { "X-Forwarded-For": "not-an-ip" }
    });

    expect(response.status).toBe(403);
    expect(handlerCalls).toBe(0);
  });

  it("passes all requests through when no rules are configured", async () => {
    await startApp({ allowlist: [], denylist: [], trustedProxies: [] });

    const response = await fetch(`${baseUrl}/api/data`);

    expect(response.status).toBe(200);
    expect(handlerCalls).toBe(1);
  });

  it("keeps exempt paths reachable even when the client is denied", async () => {
    await startApp({
      allowlist: parseCidrList("203.0.113.0/24"),
      denylist: [],
      trustedProxies: [],
      exemptPaths: ["/api/health"]
    });

    const health = await fetch(`${baseUrl}/api/health`);
    const data = await fetch(`${baseUrl}/api/data`);

    expect(health.status).toBe(200);
    expect(data.status).toBe(403);
  });
});
