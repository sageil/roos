// Pure IPv4/IPv6 address and CIDR parsing and matching. No framework imports.
//
// Addresses are represented as big-endian byte arrays (4 bytes for IPv4,
// 16 for IPv6). IPv4-mapped IPv6 addresses (::ffff:a.b.c.d) are normalized
// to IPv4 so that IPv4 rules match clients that arrive over a dual-stack socket.

export type IpFamily = 4 | 6;

export type IpAddress = {
  family: IpFamily;
  bytes: number[];
};

export type CidrRange = IpAddress & {
  prefixLength: number;
};

const ipv4OctetPattern = /^(0|[1-9]\d{0,2})$/;
const ipv6GroupPattern = /^[0-9a-fA-F]{1,4}$/;
const prefixPattern = /^(0|[1-9]\d*)$/;
const ipv4MappedPrefixLength = 96;

// Parses an address without normalizing IPv4-mapped IPv6. Throws a reason-only
// error; callers add the input value to the message.
const parseAddressRaw = (text: string): IpAddress => {
  if (text.includes(":")) {
    return parseIpv6(text);
  }

  if (text.includes(".")) {
    return parseIpv4(text);
  }

  throw new Error("not a valid IP address");
};

const parseIpv4 = (text: string): IpAddress => {
  const octets = text.split(".");
  if (octets.length !== 4) {
    throw new Error("IPv4 must have four octets");
  }

  const bytes = octets.map((octet) => {
    if (!ipv4OctetPattern.test(octet)) {
      throw new Error(`invalid IPv4 octet "${octet}"`);
    }

    const value = Number(octet);
    if (value > 255) {
      throw new Error(`IPv4 octet out of range "${octet}"`);
    }

    return value;
  });

  return { family: 4, bytes };
};

const ipv4ToHextets = (bytes: number[]): string[] => [
  ((bytes[0] << 8) | bytes[1]).toString(16),
  ((bytes[2] << 8) | bytes[3]).toString(16)
];

const parseIpv6 = (text: string): IpAddress => {
  if (text.includes("%")) {
    throw new Error("IPv6 zone identifiers are not supported");
  }

  const compressionParts = text.split("::");
  if (compressionParts.length > 2) {
    throw new Error("only one '::' is allowed");
  }

  const compressed = compressionParts.length === 2;
  let groups: string[];
  let head: string[];
  let tail: string[];

  if (compressed) {
    head = compressionParts[0] ? compressionParts[0].split(":") : [];
    tail = compressionParts[1] ? compressionParts[1].split(":") : [];
    groups = [...head, ...tail];
  } else {
    head = text.split(":");
    tail = [];
    groups = head;
  }

  // An embedded IPv4 tail counts as two hextets and must be the last component.
  const lastGroup = groups[groups.length - 1];
  if (lastGroup !== undefined && lastGroup.includes(".")) {
    const [hi, lo] = ipv4ToHextets(parseIpv4(lastGroup).bytes);
    if (compressed && tail.length > 0) {
      tail = [...tail.slice(0, -1), hi, lo];
    } else {
      head = [...head.slice(0, -1), hi, lo];
    }
    groups = compressed ? [...head, ...tail] : head;
  }

  const explicitCount = groups.length;
  if (compressed) {
    if (explicitCount >= 8) {
      throw new Error("too many groups for '::'");
    }
  } else if (explicitCount !== 8) {
    throw new Error("IPv6 must have eight groups");
  }

  const hextets = groups.map((group) => {
    if (!ipv6GroupPattern.test(group)) {
      throw new Error(`invalid IPv6 group "${group}"`);
    }

    return Number.parseInt(group, 16);
  });

  const fill = 8 - explicitCount;
  const expanded = compressed
    ? [...hextets.slice(0, head.length), ...new Array<number>(fill).fill(0), ...hextets.slice(head.length)]
    : hextets;

  const bytes: number[] = [];
  for (const hextet of expanded) {
    bytes.push(hextet >> 8, hextet & 0xff);
  }

  return { family: 6, bytes };
};

const isIpv4Mapped = (bytes: number[]) =>
  bytes.slice(0, 10).every((byte) => byte === 0) && bytes[10] === 0xff && bytes[11] === 0xff;

const normalize = (address: IpAddress): IpAddress =>
  address.family === 6 && isIpv4Mapped(address.bytes)
    ? { family: 4, bytes: address.bytes.slice(12) }
    : address;

const invalidAddressError = (value: string, error: unknown) =>
  new Error(`Invalid IP address "${value}": ${(error as Error).message}`);

// Parses a single IP address. IPv4-mapped IPv6 input is returned as IPv4.
export const parseIpAddress = (value: string): IpAddress => {
  const trimmed = value.trim();
  if (trimmed === "") {
    throw new Error('Invalid IP address "": value is empty');
  }

  try {
    return normalize(parseAddressRaw(trimmed));
  } catch (error) {
    throw invalidAddressError(value, error);
  }
};

// Zeroes every bit after the first prefixLength bits.
const maskBytes = (bytes: number[], prefixLength: number) =>
  bytes.map((byte, index) => {
    const bitsInByte = Math.min(8, Math.max(0, prefixLength - index * 8));
    const mask = bitsInByte === 0 ? 0 : (0xff << (8 - bitsInByte)) & 0xff;
    return byte & mask;
  });

const parseCidrUnchecked = (value: string): CidrRange => {
  const trimmed = value.trim();
  if (trimmed === "") {
    throw new Error("value is empty");
  }

  const slashParts = trimmed.split("/");
  if (slashParts.length > 2) {
    throw new Error("expected exactly one '/'");
  }

  const [addressText, prefixText] = slashParts;
  const raw = parseAddressRaw(addressText);

  // Bare address: a single host.
  if (prefixText === undefined) {
    const address = normalize(raw);
    const prefixLength = address.bytes.length * 8;
    return { ...address, bytes: maskBytes(address.bytes, prefixLength), prefixLength };
  }

  if (!prefixPattern.test(prefixText)) {
    throw new Error(`prefix length must be a non-negative integer, got "${prefixText}"`);
  }
  const prefix = Number(prefixText);

  // IPv4-mapped IPv6 CIDRs are only meaningful at /96 or longer.
  if (raw.family === 6 && isIpv4Mapped(raw.bytes)) {
    if (prefix < ipv4MappedPrefixLength) {
      throw new Error(`IPv4-mapped IPv6 prefix shorter than /${ipv4MappedPrefixLength} is not supported`);
    }
    if (prefix > 128) {
      throw new Error("IPv6 prefix length must be between 0 and 128");
    }

    const bytes = raw.bytes.slice(12);
    const prefixLength = prefix - ipv4MappedPrefixLength;
    return { family: 4, bytes: maskBytes(bytes, prefixLength), prefixLength };
  }

  const maxPrefix = raw.family === 4 ? 32 : 128;
  if (prefix > maxPrefix) {
    throw new Error(`IPv${raw.family} prefix length must be between 0 and ${maxPrefix}`);
  }

  return { ...raw, bytes: maskBytes(raw.bytes, prefix), prefixLength: prefix };
};

// Parses "addr/prefix" or a bare address (treated as a single host).
export const parseCidr = (value: string): CidrRange => {
  try {
    return parseCidrUnchecked(value);
  } catch (error) {
    throw new Error(`Invalid CIDR "${value}": ${(error as Error).message}`);
  }
};

// Parses a comma-separated list. A blank value yields no entries; an empty
// entry (such as from a trailing comma) is an error.
export const parseCidrList = (value: string): CidrRange[] => {
  if (value.trim() === "") {
    return [];
  }

  return value.split(",").map((entry) => {
    if (entry.trim() === "") {
      throw new Error(`Invalid CIDR list "${value}": contains an empty entry`);
    }

    return parseCidr(entry);
  });
};

// Tests an address against a parsed range. Addresses that do not parse never match.
export const isIpInCidr = (address: string, range: CidrRange): boolean => {
  let parsed: IpAddress;
  try {
    parsed = parseIpAddress(address);
  } catch {
    return false;
  }

  if (parsed.family !== range.family) {
    return false;
  }

  const masked = maskBytes(parsed.bytes, range.prefixLength);
  return masked.every((byte, index) => byte === range.bytes[index]);
};

export const isIpInAnyCidr = (address: string, ranges: readonly CidrRange[]): boolean =>
  ranges.some((range) => isIpInCidr(address, range));
