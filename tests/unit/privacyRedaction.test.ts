import { describe, expect, it } from "vitest";
import { detectResumePrivacy, redactResumePrivacy } from "../../src/server/privacyRedaction.js";

describe("redactResumePrivacy", () => {
  it("redacts confirmed profile name and email before analysis", () => {
    const resume = [
      "JANE ALEXANDRA DOE",
      "JANE.DOE@example.com",
      "Experienced veterinary receptionist with appointment scheduling and client intake ownership."
    ].join("\n");

    const result = redactResumePrivacy(resume, {
      name: "Jane Alexandra Doe",
      emails: ["jane.doe@example.com"]
    });

    expect(result.text).not.toContain("JANE ALEXANDRA DOE");
    expect(result.text).not.toContain("JANE.DOE@example.com");
    expect(result.text).not.toContain("CANDIDATE_NAME");
    expect(result.text).not.toContain("EMAIL_REDACTED");
    expect(result.text).toBe("Experienced veterinary receptionist with appointment scheduling and client intake ownership.");
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
    expect(result.text).not.toContain("ADDRESS_REDACTED");
    expect(result.text).toContain("Melbourne and regional clinics");
    expect(result.summary).toMatchObject({ address: 1, total: 1 });
  });

  it("redacts phone numbers across common punctuation variants", () => {
    const result = redactResumePrivacy("Mobile: 0412 345 678", {
      phones: ["0412-345-678"]
    });

    expect(result.text).toBe("");
    expect(result.summary).toMatchObject({ phone: 1, total: 1 });
  });

  it("redacts confirmed personal links", () => {
    const result = redactResumePrivacy("Portfolio: https://example.com/jane", {
      links: ["https://example.com/jane"]
    });

    expect(result.text).toBe("");
    expect(result.summary).toMatchObject({ link: 1, total: 1 });
  });

  it("ignores empty and underspecified values", () => {
    const result = redactResumePrivacy("Senior receptionist with phone triage support experience.", {
      name: "Al",
      emails: [""],
      phones: ["123"],
      addressLines: ["  "],
      links: ["abc"]
    });

    expect(result.text).toBe("Senior receptionist with phone triage support experience.");
    expect(result.summary.total).toBe(0);
  });
});

describe("detectResumePrivacy", () => {
  it("detects likely privacy values from resume text plus profile data", () => {
    const detected = detectResumePrivacy(
      [
        "PRIYA PATEL",
        "Priya Patel",
        "Email priya.patel@example.com.au",
        "Phone +61 400 123 456",
        "Portfolio https://example.com/priya",
        "12 George Street Sydney NSW"
      ].join("\n"),
      {
        name: "Priya Patel",
        email: "priya.patel@example.com.au"
      }
    );

    expect(detected).toMatchObject({
      name: "PRIYA PATEL",
      names: ["PRIYA PATEL"],
      emails: ["priya.patel@example.com.au"],
      phones: ["+61 400 123 456"],
      links: ["https://example.com/priya"]
    });
    expect(detected.addressLines).toEqual(["12 George Street Sydney NSW"]);
  });

  it("detects glued street and city address lines", () => {
    const detected = detectResumePrivacy(
      [
        "TEST CANDIDATE",
        "PHONE_REDACTED",
        "EMAIL_REDACTED",
        "123 Fictional Ridge DriveExampleton VIC 3000",
        "Reception workflow ownership."
      ].join("\n"),
      {
        name: "Demo Profile",
        email: "demo.profile@example.test"
      }
    );

    expect(detected.name).toBe("TEST CANDIDATE");
    expect(detected.names).toEqual(["TEST CANDIDATE", "Demo Profile"]);
    expect(detected.addressLines).toEqual(["123 Fictional Ridge DriveExampleton VIC 3000"]);
  });

  it("does not include resume body text after a detected address", () => {
    const detected = detectResumePrivacy(
      [
        "TEST CANDIDATE",
        "test.candidate@example.test",
        "555-010-4615",
        "123 Fictional Ridge DriveExampleton VIC 3000 Managed appointment books and client intake across 2 busy veterinary reception desks.",
        "Coordinated urgent visit arrivals with veterinarians and nurses."
      ].join("\n"),
      {
        name: "Test Candidate",
        email: "test.candidate@example.test"
      }
    );

    expect(detected.addressLines).toEqual(["123 Fictional Ridge DriveExampleton VIC 3000"]);
    expect(detected.addressLines?.[0]).not.toContain("Managed appointment");
    expect(detected.addressLines?.[0]).not.toContain("Coordinated urgent");
  });
});
