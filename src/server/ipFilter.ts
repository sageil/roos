import type { NextFunction, Request, Response } from "express";
import { isIpInAnyCidr, parseIpAddress, type CidrRange } from "./ipCidr.js";

export type IpFilterOptions = {
  allowlist: readonly CidrRange[];
  denylist: readonly CidrRange[];
  trustedProxies: readonly CidrRange[];
  // Paths that bypass filtering, such as health probes used by the container runtime.
  exemptPaths?: readonly string[];
};

const isTrusted = (address: string, trustedProxies: readonly CidrRange[]) =>
  isIpInAnyCidr(address, trustedProxies);

const isValidAddress = (value: string): boolean => {
  try {
    parseIpAddress(value);
    return true;
  } catch {
    return false;
  }
};

// Resolves the client address. X-Forwarded-For is honoured only when the socket
// peer is a trusted proxy. The header is walked right to left, skipping trusted
// proxy hops, so the first untrusted hop is the client. Entries a client could
// have added on its own sit to the left of that hop and are ignored. Returns
// undefined when a hop is not a valid IP, which fails closed.
export const resolveClientAddress = (
  socketAddress: string | undefined,
  forwardedFor: string | undefined,
  trustedProxies: readonly CidrRange[]
): string | undefined => {
  const peer = socketAddress?.trim();
  if (!peer) {
    return undefined;
  }

  if (!forwardedFor || !isTrusted(peer, trustedProxies)) {
    return peer;
  }

  const hops = forwardedFor.split(",").map((hop) => hop.trim());
  if (!hops.every(isValidAddress)) {
    return undefined;
  }

  // Walk from the right, past trusted proxy hops. The leftmost hop is the
  // fallback when every hop is trusted.
  let index = hops.length - 1;
  while (index > 0 && isTrusted(hops[index], trustedProxies)) {
    index -= 1;
  }

  return hops[index];
};

// Denylist wins over allowlist. An empty allowlist admits every address that
// is not denied. A non-empty allowlist admits only listed addresses. A client
// that cannot be identified is refused whenever rules exist, so a malformed
// forwarded hop cannot slip past the denylist.
export const isClientAllowed = (
  clientAddress: string | undefined,
  rules: { allowlist: readonly CidrRange[]; denylist: readonly CidrRange[] }
): boolean => {
  if (clientAddress === undefined) {
    return false;
  }

  if (isIpInAnyCidr(clientAddress, rules.denylist)) {
    return false;
  }

  return rules.allowlist.length === 0 || isIpInAnyCidr(clientAddress, rules.allowlist);
};

// Express middleware. With no configured rules it passes every request through.
// The response is generic and does not echo the client address.
export const createIpFilter = (options: IpFilterOptions) => {
  const exemptPaths = new Set(options.exemptPaths ?? []);
  const hasRules = options.allowlist.length > 0 || options.denylist.length > 0;

  return (request: Request, response: Response, next: NextFunction) => {
    if (!hasRules || exemptPaths.has(request.path)) {
      next();
      return;
    }

    const forwardedHeader = request.headers["x-forwarded-for"];
    const forwardedFor = Array.isArray(forwardedHeader) ? forwardedHeader.join(",") : forwardedHeader;
    const clientAddress = resolveClientAddress(
      request.socket.remoteAddress,
      forwardedFor,
      options.trustedProxies
    );

    if (!isClientAllowed(clientAddress, options)) {
      response.status(403).json({ error: "Forbidden." });
      return;
    }

    next();
  };
};
