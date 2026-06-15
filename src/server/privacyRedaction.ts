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

const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const urlPattern = /\b(?:https?:\/\/|www\.)[^\s<>()]+/gi;
const phoneCandidatePattern = /(?<!\d)(?:\+?\d[\s().-]*){8,}\d(?!\d)/g;
const streetSuffixWords =
  "street|st|road|rd|avenue|ave|drive|dr|lane|ln|court|ct|place|pl|terrace|tce|boulevard|blvd|way|unit|suite";
const streetSuffixPattern =
  new RegExp(`\\b(?:${streetSuffixWords})(?=\\b|[A-Z])`, "i");
const streetSuffixSource = `\\b(?:${streetSuffixWords})(?=\\b|[A-Z])`;
const postalCodeSource =
  "[A-Z]\\d[A-Z][ -]?\\d[A-Z]\\d|\\d{5}(?:-\\d{4})?|(?:NSW|VIC|QLD|WA|SA|TAS|ACT|NT)?\\s*\\d{4}";
const postalCodePattern =
  new RegExp(`\\b(?:${postalCodeSource})\\b`, "i");
const addressLinePattern =
  new RegExp(`\\b\\d{1,6}[ \\t]+[A-Za-z0-9.' -]+${streetSuffixSource}[^\\n]*`, "gi");
const addressWithPostalPattern = new RegExp(
  `^(\\d{1,6}\\s+.{2,120}?${streetSuffixSource}.{0,90}?\\b(?:${postalCodeSource})\\b)`,
  "i"
);
const streetAddressStartPattern = new RegExp(`^(\\d{1,6}\\s+.{2,100}?${streetSuffixSource}(?:[A-Z][A-Za-z.'-]+)?)`, "i");
const addressBodyStopWords = new Set([
  "achieved",
  "built",
  "core",
  "created",
  "delivered",
  "developed",
  "education",
  "employment",
  "engineered",
  "experience",
  "implemented",
  "led",
  "managed",
  "owned",
  "professional",
  "recruited",
  "responsible",
  "skills",
  "worked"
]);
const nameLinePattern = /^[A-Za-z][A-Za-z' -]{2,80}$/;
const nameWordPattern = /^[A-Za-z][A-Za-z'-]*$/;
const ignoredNameHeadings = new Set([
  "career profile",
  "certifications",
  "contact",
  "core competencies",
  "education",
  "experience",
  "objective",
  "professional experience",
  "professional summary",
  "references",
  "resume",
  "skills",
  "summary",
  "work experience"
]);
const placeholderOnlyPattern =
  /\b(?:CANDIDATE_NAME|EMAIL_REDACTED|PHONE_REDACTED|ADDRESS_REDACTED|LINK_REDACTED)\b/g;
const privacyLabelPattern =
  /\b(?:address|contact|e-mail|email|linkedin|mobile|name|phone|portfolio|website)\b/gi;

const normalizeDetected = (values: string[], minimumLength = 3, limit = 10) =>
  uniqueValues(values, minimumLength).slice(0, limit);

const cleanAddressCandidate = (value: string) =>
  normalize(value)
    .replace(/^(?:address|home address|location)\s*:?\s*/i, "")
    .replace(/[.;,]+$/, "")
    .trim();

const trimAddressCandidate = (value: string) => {
  const line = cleanAddressCandidate(value);
  if (!/^\d{1,6}\s+/.test(line) || (!streetSuffixPattern.test(line) && !postalCodePattern.test(line))) {
    return undefined;
  }

  const withPostal = line.match(addressWithPostalPattern)?.[1];
  if (withPostal) {
    return cleanAddressCandidate(withPostal);
  }

  const streetStart = line.match(streetAddressStartPattern)?.[1];
  if (!streetStart) {
    return undefined;
  }

  const localityWords: string[] = [];
  const remainder = line.slice(streetStart.length).replace(/^[,\s]+/, "");
  for (const word of remainder.split(/[\s,]+/).filter(Boolean)) {
    const normalizedWord = word.replace(/[^A-Za-z.'-]/g, "");
    if (!normalizedWord || addressBodyStopWords.has(normalizedWord.toLowerCase())) {
      break;
    }
    localityWords.push(word);
    if (localityWords.length >= 4) {
      break;
    }
  }

  return cleanAddressCandidate([streetStart, ...localityWords].join(" "));
};

const lineLooksLikeName = (line: string) => {
  const normalized = normalize(line);
  const lower = normalized.toLowerCase();
  if (!nameLinePattern.test(normalized) || ignoredNameHeadings.has(lower)) {
    return false;
  }

  const words = normalized.split(" ");
  if (words.length < 2 || words.length > 4 || words.some((word) => !nameWordPattern.test(word))) {
    return false;
  }

  return words.every((word) => word.length > 1);
};

const detectNameCandidates = (resumeText: string, profileName: string) => {
  const lines = resumeText
    .split(/\r?\n/)
    .map(normalize)
    .filter(Boolean)
    .slice(0, 12);

  return normalizeDetected(
    [
      ...lines.filter((line) => {
        if (emailPattern.test(line) || urlPattern.test(line) || phoneCandidatePattern.test(line) || /\d/.test(line)) {
          return false;
        }
        emailPattern.lastIndex = 0;
        urlPattern.lastIndex = 0;
        phoneCandidatePattern.lastIndex = 0;
        return lineLooksLikeName(line);
      }),
      profileName
    ],
    2,
    5
  );
};

const detectAddressLines = (resumeText: string) => {
  const lineCandidates = resumeText
    .split(/\r?\n/)
    .map(trimAddressCandidate)
    .filter((line): line is string => Boolean(line));
  const patternCandidates = (resumeText.match(addressLinePattern) ?? [])
    .map(trimAddressCandidate)
    .filter((line): line is string => Boolean(line));

  return normalizeDetected([...patternCandidates, ...lineCandidates], 6, 8);
};

const stripPrivacyOnlyLines = (text: string) =>
  text
    .split(/\r?\n/)
    .filter((line) => {
      if (!placeholderOnlyPattern.test(line)) {
        placeholderOnlyPattern.lastIndex = 0;
        return true;
      }
      placeholderOnlyPattern.lastIndex = 0;

      const remainder = line
        .replace(placeholderOnlyPattern, "")
        .replace(privacyLabelPattern, "")
        .replace(/[|:;,()[\]{}./\\_-]+/g, "")
        .trim();
      placeholderOnlyPattern.lastIndex = 0;
      privacyLabelPattern.lastIndex = 0;
      return remainder.length > 0;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export const detectResumePrivacy = (
  resumeText: string,
  profile: { name: string; email: string }
): PrivacyRedactionInput => {
  const emails = normalizeDetected([
    profile.email,
    ...(resumeText.match(emailPattern) ?? [])
  ], 3, 10);
  const phones = normalizeDetected(resumeText.match(phoneCandidatePattern) ?? [], 7, 10);
  const links = normalizeDetected(
    (resumeText.match(urlPattern) ?? []).map((link) => link.replace(/[),.;]+$/, "")),
    4,
    10
  );
  const addressLines = detectAddressLines(resumeText);
  const names = detectNameCandidates(resumeText, profile.name);

  return {
    name: names[0] ?? profile.name,
    names,
    emails,
    phones,
    addressLines,
    links
  };
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

  return { text: stripPrivacyOnlyLines(text), summary };
};
