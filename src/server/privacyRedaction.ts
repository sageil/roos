import type { PrivacyRedactionSummary } from "../shared/types.js";

export type PrivacyRedactionInput = {
  name?: string;
  names?: string[];
  emails?: string[];
  phones?: string[];
  addressLines?: string[];
  links?: string[];
};

type RedactionCategory = Exclude<keyof PrivacyRedactionSummary, "total">;

const emptySummary = (): PrivacyRedactionSummary => ({
  name: 0,
  email: 0,
  phone: 0,
  address: 0,
  link: 0,
  total: 0
});

const placeholders: Record<RedactionCategory, string> = {
  name: "CANDIDATE_NAME",
  email: "EMAIL_REDACTED",
  phone: "PHONE_REDACTED",
  address: "ADDRESS_REDACTED",
  link: "LINK_REDACTED"
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalize = (value: string) => value.trim().replace(/\s+/g, " ");

const uniqueValues = (values: string[] = [], minimumLength = 3) => {
  const seen = new Set<string>();
  return values
    .flatMap((value) => value.split(/\r?\n/))
    .map(normalize)
    .filter((value) => value.length >= minimumLength)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
};

const phrasePattern = (value: string) =>
  escapeRegExp(value)
    .replace(/\\ /g, "\\s+")
    .replace(/\\,/g, "\\s*,\\s*")
    .replace(/\\-/g, "\\s*-\\s*");

const countMatches = (text: string, pattern: RegExp) => {
  const matches = text.match(pattern);
  return matches?.length ?? 0;
};

const replaceMatches = ({
  text,
  summary,
  category,
  pattern
}: {
  text: string;
  summary: PrivacyRedactionSummary;
  category: RedactionCategory;
  pattern: RegExp;
}) => {
  const count = countMatches(text, pattern);
  if (count === 0) {
    return text;
  }

  summary[category] += count;
  summary.total += count;
  return text.replace(pattern, placeholders[category]);
};

const phonePattern = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) {
    return undefined;
  }

  const body = digits
    .split("")
    .map((digit) => escapeRegExp(digit))
    .join("[\\s().-]*");
  return new RegExp(`(?<!\\d)${body}(?!\\d)`, "gi");
};

export const redactResumePrivacy = (
  resumeText: string,
  redactions: PrivacyRedactionInput
): { text: string; summary: PrivacyRedactionSummary } => {
  const summary = emptySummary();
  let text = resumeText;

  for (const name of uniqueValues([...(redactions.names ?? []), ...(redactions.name ? [redactions.name] : [])], 2)) {
    text = replaceMatches({
      text,
      summary,
      category: "name",
      pattern: new RegExp(`\\b${phrasePattern(name)}\\b`, "gi")
    });
  }

  for (const email of uniqueValues(redactions.emails)) {
    text = replaceMatches({
      text,
      summary,
      category: "email",
      pattern: new RegExp(escapeRegExp(email), "gi")
    });
  }

  for (const phone of uniqueValues(redactions.phones, 7)) {
    const pattern = phonePattern(phone);
    if (!pattern) {
      continue;
    }

    text = replaceMatches({
      text,
      summary,
      category: "phone",
      pattern
    });
  }

  for (const addressLine of uniqueValues(redactions.addressLines)) {
    text = replaceMatches({
      text,
      summary,
      category: "address",
      pattern: new RegExp(phrasePattern(addressLine), "gi")
    });
  }

  for (const link of uniqueValues(redactions.links, 4)) {
    text = replaceMatches({
      text,
      summary,
      category: "link",
      pattern: new RegExp(escapeRegExp(link), "gi")
    });
  }

  return { text, summary };
};
