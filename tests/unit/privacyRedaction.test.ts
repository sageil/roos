import { describe, expect, it } from "vitest";
import { redactResumePrivacy } from "../../src/server/privacyRedaction.js";

describe("redactResumePrivacy", () => {
  it("redacts confirmed profile name and email before analysis", () => {
    const resume = [
      "Jane Alexandra Doe",
      "jane.doe@example.com",
      "Experienced operations leader with payroll and rostering ownership."
    ].join("\n");

    const result = redactResumePrivacy(resume, {
      name: "Jane Alexandra Doe",
      emails: ["jane.doe@example.com"]
    });

    expect(result.text).not.toContain("Jane Alexandra Doe");
    expect(result.text).not.toContain("jane.doe@example.com");
    expect(result.text).toContain("CANDIDATE_NAME");
    expect(result.text).toContain("EMAIL_REDACTED");
    expect(result.summary).toMatchObject({ name: 1, email: 1, total: 2 });
  });

  it("redacts multiple confirmed names", () => {
    const result = redactResumePrivacy("Jane Doe also publishes as Jane Smith.", {
      names: ["Jane Doe"],
      name: "Jane Smith"
    });

    expect(result.text).toBe("CANDIDATE_NAME also publishes as CANDIDATE_NAME.");
    expect(result.summary).toMatchObject({ name: 2, total: 2 });
  });

  it("redacts user-confirmed address lines without guessing unrelated locations", () => {
    const resume = [
      "ADDRESS 12 Example Street, Richmond VIC 3121",
      "Delivered customer support across Melbourne and regional clinics."
    ].join("\n");

    const result = redactResumePrivacy(resume, {
      addressLines: ["12 Example Street, Richmond VIC 3121"]
    });

    expect(result.text).not.toContain("12 Example Street");
    expect(result.text).toContain("ADDRESS ADDRESS_REDACTED");
    expect(result.text).toContain("Melbourne and regional clinics");
    expect(result.summary).toMatchObject({ address: 1, total: 1 });
  });

  it("redacts phone numbers across common punctuation variants", () => {
    const result = redactResumePrivacy("Mobile: 0412 345 678", {
      phones: ["0412-345-678"]
    });

    expect(result.text).toBe("Mobile: PHONE_REDACTED");
    expect(result.summary).toMatchObject({ phone: 1, total: 1 });
  });

  it("redacts confirmed personal links", () => {
    const result = redactResumePrivacy("Portfolio: https://example.com/jane", {
      links: ["https://example.com/jane"]
    });

    expect(result.text).toBe("Portfolio: LINK_REDACTED");
    expect(result.summary).toMatchObject({ link: 1, total: 1 });
  });

  it("ignores empty and underspecified values", () => {
    const result = redactResumePrivacy("Senior receptionist with BAS support experience.", {
      name: "Al",
      emails: [""],
      phones: ["123"],
      addressLines: ["  "],
      links: ["abc"]
    });

    expect(result.text).toBe("Senior receptionist with BAS support experience.");
    expect(result.summary.total).toBe(0);
  });
});
