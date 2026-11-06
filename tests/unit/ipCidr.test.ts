import { describe, expect, it } from "vitest";
import {
  isIpInAnyCidr,
  isIpInCidr,
  parseCidr,
  parseCidrList,
  parseIpAddress
} from "../../src/server/ipCidr.js";

describe("parseIpAddress", () => {
  it("parses IPv4 dotted quads into four bytes", () => {
    expect(parseIpAddress("10.0.0.1")).toEqual({ family: 4, bytes: [10, 0, 0, 1] });
    expect(parseIpAddress("0.0.0.0")).toEqual({ family: 4, bytes: [0, 0, 0, 0] });
    expect(parseIpAddress("255.255.255.255")).toEqual({ family: 4, bytes: [255, 255, 255, 255] });
  });

  it("parses IPv6 addresses with and without compression", () => {
    expect(parseIpAddress("2001:db8::1")).toEqual({
      family: 6,
      bytes: [0x20, 0x01, 0x0d, 0xb8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]
    });
    expect(parseIpAddress("::")).toEqual({ family: 6, bytes: new Array(16).fill(0) });
    expect(parseIpAddress("::1")).toEqual({
      family: 6,
      bytes: [...new Array(15).fill(0), 1]
    });
    expect(parseIpAddress("1:2:3:4:5:6:7:8")).toEqual({
      family: 6,
      bytes: [0, 1, 0, 2, 0, 3, 0, 4, 0, 5, 0, 6, 0, 7, 0, 8]
    });
    expect(parseIpAddress("FE80::ABCD")).toEqual({
      family: 6,
      bytes: [0xfe, 0x80, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xab, 0xcd]
    });
  });

  it("parses IPv6 with an embedded IPv4 tail", () => {
    expect(parseIpAddress("64:ff9b::192.0.2.33")).toEqual({
      family: 6,
      bytes: [0, 0x64, 0xff, 0x9b, 0, 0, 0, 0, 0, 0, 0, 0, 192, 0, 2, 33]
    });
  });

  it("normalizes IPv4-mapped IPv6 addresses to IPv4", () => {
    expect(parseIpAddress("::ffff:10.0.0.1")).toEqual({ family: 4, bytes: [10, 0, 0, 1] });
    expect(parseIpAddress("::FFFF:192.168.1.20")).toEqual({ family: 4, bytes: [192, 168, 1, 20] });
    expect(parseIpAddress("::ffff:a00:1")).toEqual({ family: 4, bytes: [10, 0, 0, 1] });
  });

  it("parses an uncompressed IPv6 address with an embedded IPv4 tail", () => {
    expect(parseIpAddress("0:0:0:0:0:ffff:c000:221")).toEqual({ family: 4, bytes: [192, 0, 2, 33] });
    expect(parseIpAddress("1:2:3:4:5:6:10.0.0.1")).toEqual({
      family: 6,
      bytes: [0, 1, 0, 2, 0, 3, 0, 4, 0, 5, 0, 6, 10, 0, 0, 1]
    });
  });

  it("keeps IPv4-compatible and non-mapped addresses as IPv6", () => {
    expect(parseIpAddress("::10.0.0.1").family).toBe(6);
    expect(parseIpAddress("::fffe:10.0.0.1").family).toBe(6);
  });

  it("trims surrounding whitespace", () => {
    expect(parseIpAddress("  10.0.0.1 ")).toEqual({ family: 4, bytes: [10, 0, 0, 1] });
  });

  it.each([
    ["", "empty"],
    ["10.0.0", "IPv4 must have four octets"],
    ["10.0.0.1.5", "IPv4 must have four octets"],
    ["10.0.0.256", "octet out of range"],
    ["10.0.0.-1", "invalid IPv4 octet"],
    ["10.0.0.01", "invalid IPv4 octet"],
    ["10.0.0.a", "invalid IPv4 octet"],
    ["10.0.0.", "invalid IPv4 octet"],
    ["fe80::1%eth0", "zone identifiers"],
    ["1:2:3:4:5:6:7:8:9", "IPv6 must have eight groups"],
    ["1:2:3:4:5:6:7", "IPv6 must have eight groups"],
    ["1::2::3", "only one '::'"],
    ["12345::1", "invalid IPv6 group"],
    ["gggg::1", "invalid IPv6 group"],
    ["1:2:3:4:5:6:7::8", "too many groups for '::'"],
    ["::ffff:10.0.0.256", "octet out of range"],
    ["hostname", "not a valid IP address"]
  ])("rejects %j with a clear error (%s)", (value) => {
    expect(() => parseIpAddress(value)).toThrow(/Invalid IP address/);
  });
});

describe("parseCidr", () => {
  it("parses IPv4 CIDR ranges", () => {
    expect(parseCidr("10.0.0.0/8")).toEqual({
      family: 4,
      bytes: [10, 0, 0, 0],
      prefixLength: 8
    });
  });

  it("treats a bare IPv4 address as a single host", () => {
    expect(parseCidr("203.0.113.7")).toEqual({
      family: 4,
      bytes: [203, 0, 113, 7],
      prefixLength: 32
    });
  });

  it("treats a bare IPv6 address as a single host", () => {
    expect(parseCidr("2001:db8::5")).toEqual({
      family: 6,
      bytes: [0x20, 0x01, 0x0d, 0xb8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
      prefixLength: 128
    });
  });

  it("parses IPv6 CIDR ranges", () => {
    expect(parseCidr("fd00::/8")).toEqual({
      family: 6,
      bytes: [0xfd, 0, ...new Array(14).fill(0)],
      prefixLength: 8
    });
  });

  it("accepts boundary prefix lengths", () => {
    expect(parseCidr("0.0.0.0/0").prefixLength).toBe(0);
    expect(parseCidr("10.0.0.1/32").prefixLength).toBe(32);
    expect(parseCidr("::/0").prefixLength).toBe(0);
    expect(parseCidr("::1/128").prefixLength).toBe(128);
  });

  it("zeroes host bits so the network address is canonical", () => {
    expect(parseCidr("10.1.2.3/8").bytes).toEqual([10, 0, 0, 0]);
    expect(parseCidr("2001:db8::ffff/64").bytes.slice(8)).toEqual(new Array(8).fill(0));
  });

  it("normalizes IPv4-mapped IPv6 CIDRs of /96 or longer to IPv4", () => {
    expect(parseCidr("::ffff:10.0.0.0/104")).toEqual({
      family: 4,
      bytes: [10, 0, 0, 0],
      prefixLength: 8
    });
    expect(parseCidr("::ffff:192.168.1.5")).toEqual({
      family: 4,
      bytes: [192, 168, 1, 5],
      prefixLength: 32
    });
  });

  it("rejects IPv4-mapped IPv6 CIDRs shorter than /96", () => {
    expect(() => parseCidr("::ffff:0:0/80")).toThrow(/shorter than \/96/);
  });

  it("rejects IPv4-mapped IPv6 CIDRs with a prefix above 128", () => {
    expect(() => parseCidr("::ffff:10.0.0.0/200")).toThrow(/between 0 and 128/);
  });

  it.each([
    ["10.0.0.0/33", "IPv4 prefix length must be between 0 and 32"],
    ["10.0.0.0/-1", "prefix length must be"],
    ["10.0.0.0/", "prefix length must be"],
    ["10.0.0.0/8/8", "exactly one '/'"],
    ["10.0.0.0/eight", "prefix length must be"],
    ["10.0.0.0/08", "prefix length must be"],
    ["2001:db8::/129", "IPv6 prefix length must be between 0 and 128"],
    ["10.0.0/8", "IPv4 must have four octets"],
    ["", "empty"],
    ["   ", "empty"]
  ])("rejects %j with a clear error (%s)", (value, message) => {
    expect(() => parseCidr(value)).toThrow(new RegExp(message.replace(/[()'/]/g, "\\$&")));
  });

  it("includes the offending value in the error message", () => {
    expect(() => parseCidr("10.0.0.0/40")).toThrow(/"10\.0\.0\.0\/40"/);
  });
});

describe("isIpInCidr", () => {
  it("matches IPv4 addresses inside a range", () => {
    const range = parseCidr("10.0.0.0/8");

    expect(isIpInCidr("10.0.0.1", range)).toBe(true);
    expect(isIpInCidr("10.255.255.255", range)).toBe(true);
    expect(isIpInCidr("10.0.0.0", range)).toBe(true);
  });

  it("rejects IPv4 addresses outside a range", () => {
    const range = parseCidr("10.0.0.0/8");

    expect(isIpInCidr("11.0.0.0", range)).toBe(false);
    expect(isIpInCidr("9.255.255.255", range)).toBe(false);
  });

  it("matches on partial-octet prefixes", () => {
    const range = parseCidr("172.16.0.0/12");

    expect(isIpInCidr("172.16.0.0", range)).toBe(true);
    expect(isIpInCidr("172.31.255.255", range)).toBe(true);
    expect(isIpInCidr("172.32.0.0", range)).toBe(false);
    expect(isIpInCidr("172.15.255.255", range)).toBe(false);
  });

  it("matches a single host entry only for that exact address", () => {
    const host = parseCidr("203.0.113.7");

    expect(isIpInCidr("203.0.113.7", host)).toBe(true);
    expect(isIpInCidr("203.0.113.8", host)).toBe(false);
    expect(isIpInCidr("203.0.113.6", host)).toBe(false);
  });

  it("matches everything for a /0 range of the same family", () => {
    expect(isIpInCidr("8.8.8.8", parseCidr("0.0.0.0/0"))).toBe(true);
    expect(isIpInCidr("2001:db8::1", parseCidr("::/0"))).toBe(true);
  });

  it("matches IPv6 addresses inside and outside a range", () => {
    const range = parseCidr("2001:db8::/32");

    expect(isIpInCidr("2001:db8::1", range)).toBe(true);
    expect(isIpInCidr("2001:db8:ffff:ffff:ffff:ffff:ffff:ffff", range)).toBe(true);
    expect(isIpInCidr("2001:db9::1", range)).toBe(false);
  });

  it("matches IPv6 ranges that do not fall on a byte boundary", () => {
    // fc00::/7 is the unique local range: fc00-fdff, with the last bit of the first byte free.
    const range = parseCidr("fc00::/7");

    expect(isIpInCidr("fbff::1", range)).toBe(false);
    expect(isIpInCidr("fc00::1", range)).toBe(true);
    expect(isIpInCidr("fdff::1", range)).toBe(true);
    expect(isIpInCidr("fe00::1", range)).toBe(false);
  });

  it("matches IPv4 ranges that do not fall on a byte boundary", () => {
    const range = parseCidr("10.64.0.0/10");

    expect(isIpInCidr("10.63.255.255", range)).toBe(false);
    expect(isIpInCidr("10.64.0.0", range)).toBe(true);
    expect(isIpInCidr("10.127.255.255", range)).toBe(true);
    expect(isIpInCidr("10.128.0.0", range)).toBe(false);
  });

  it("never matches across address families", () => {
    expect(isIpInCidr("10.0.0.1", parseCidr("::/0"))).toBe(false);
    expect(isIpInCidr("2001:db8::1", parseCidr("0.0.0.0/0"))).toBe(false);
  });

  it("matches IPv4-mapped IPv6 client addresses against IPv4 rules", () => {
    const range = parseCidr("10.0.0.0/8");

    expect(isIpInCidr("::ffff:10.0.0.5", range)).toBe(true);
    expect(isIpInCidr("::ffff:11.0.0.5", range)).toBe(false);
  });

  it("matches IPv4-mapped IPv6 client addresses against mapped IPv6 rules", () => {
    expect(isIpInCidr("::ffff:172.16.4.4", parseCidr("::ffff:172.16.0.0/112"))).toBe(true);
    expect(isIpInCidr("::ffff:172.17.4.4", parseCidr("::ffff:172.16.0.0/112"))).toBe(false);
  });

  it("matches a single IPv4 host entry from a mapped address", () => {
    expect(isIpInCidr("::ffff:203.0.113.7", parseCidr("203.0.113.7"))).toBe(true);
  });

  it("returns false for an unparseable client address instead of throwing", () => {
    expect(isIpInCidr("not-an-ip", parseCidr("0.0.0.0/0"))).toBe(false);
    expect(isIpInCidr("", parseCidr("0.0.0.0/0"))).toBe(false);
  });
});

describe("parseCidrList", () => {
  it("returns an empty list for an unset or blank value", () => {
    expect(parseCidrList("")).toEqual([]);
    expect(parseCidrList("   ")).toEqual([]);
  });

  it("parses a comma-separated list with optional whitespace", () => {
    const list = parseCidrList("10.0.0.0/8, 192.168.1.1 ,2001:db8::/32");

    expect(list.map((entry) => entry.prefixLength)).toEqual([8, 32, 32]);
    expect(list.map((entry) => entry.family)).toEqual([4, 4, 6]);
  });

  it("rejects empty entries from trailing or doubled commas", () => {
    expect(() => parseCidrList("10.0.0.0/8,")).toThrow(/empty entry/);
    expect(() => parseCidrList(",10.0.0.0/8")).toThrow(/empty entry/);
    expect(() => parseCidrList("10.0.0.0/8,,192.168.0.0/16")).toThrow(/empty entry/);
  });

  it("names the failing entry when one is invalid", () => {
    expect(() => parseCidrList("10.0.0.0/8,10.0.0.0/99")).toThrow(/"10\.0\.0\.0\/99"/);
  });
});

describe("isIpInAnyCidr", () => {
  it("returns true when any range contains the address", () => {
    const ranges = parseCidrList("10.0.0.0/8,2001:db8::/32");

    expect(isIpInAnyCidr("2001:db8::9", ranges)).toBe(true);
    expect(isIpInAnyCidr("10.9.9.9", ranges)).toBe(true);
  });

  it("returns false when no range contains the address", () => {
    const ranges = parseCidrList("10.0.0.0/8,2001:db8::/32");

    expect(isIpInAnyCidr("192.168.0.1", ranges)).toBe(false);
  });

  it("returns false for an empty list", () => {
    expect(isIpInAnyCidr("10.0.0.1", [])).toBe(false);
  });
});
