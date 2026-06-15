import { describe, expect, it, vi } from "vitest";
import type { JobRecord, UserRecord } from "../../src/shared/types.js";

vi.mock("../../src/server/config.js", () => ({
  config: {
    host: "127.0.0.1",
    email: {
      smtpHost: "smtp.example.test",
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: "admin@example.com",
      smtpPass: "app-password",
      from: "admin@example.com",
      fromName: "Hiring Team"
    }
  }
}));

import { buildMeetingInviteIcs, buildMeetingInviteMessage } from "../../src/server/emailService.js";

const admin: UserRecord = {
  id: 1,
  name: "Hiring Admin",
  email: "admin@example.com",
  role: "admin",
  createdAt: "2026-06-15T08:00:00.000Z"
};

const job: JobRecord = {
  id: 12,
  userId: 7,
  userName: "Priya Patel",
  userEmail: "priya@example.com.au",
  status: "completed",
  applicationDate: "2026-06-14",
  jobTitle: "Veterinary Receptionist",
  jobDescription: "Manage client intake, appointment scheduling, and phone triage.",
  createdAt: "2026-06-14T10:00:00.000Z",
  updatedAt: "2026-06-14T10:10:00.000Z"
};

describe("emailService", () => {
  it("builds a calendar invite with the candidate, role, and job description", () => {
    const startsAt = new Date("2026-06-16T14:00:00.000Z");
    const ics = buildMeetingInviteIcs({
      job,
      admin,
      startsAt,
      durationMinutes: 45,
      message: "Please join this interview."
    });

    expect(ics).toContain("METHOD:REQUEST");
    expect(ics).toContain("DTSTART:20260616T140000Z");
    expect(ics).toContain("DTEND:20260616T144500Z");
    expect(ics).toContain("SUMMARY:Interview: Veterinary Receptionist");
    expect(ics).toContain("ATTENDEE;CN=Priya Patel");
    expect(ics).toContain("mailto:priya@example.com.au");
    const unfoldedIcs = ics.replace(/\r\n /g, "");
    expect(unfoldedIcs).toContain("Job description: Manage client intake\\, appointment scheduling\\, and phone triage.");
  });

  it("builds a multipart email with the invite attached", () => {
    const message = buildMeetingInviteMessage({
      job,
      admin,
      startsAt: new Date("2026-06-16T14:00:00.000Z"),
      durationMinutes: 30,
      message: "Interview details\n\nJob description:\nManage client intake."
    });

    expect(message.from).toBe("admin@example.com");
    expect(message.recipient).toBe("priya@example.com.au");
    expect(message.data).toContain("Subject: Interview invitation for Veterinary Receptionist");
    expect(message.data).toContain("Content-Type: text/calendar; charset=utf-8; method=REQUEST; name=invite.ics");
    expect(message.data).toContain("Job description:");
  });

  it("does not duplicate the job description when the editable message already contains it", () => {
    const message = buildMeetingInviteMessage({
      job,
      admin,
      startsAt: new Date("2026-06-16T14:00:00.000Z"),
      durationMinutes: 30,
      message: [
        "Interview details",
        "",
        "Job description:",
        job.jobDescription
      ].join("\n")
    });

    expect(message.data.match(new RegExp(job.jobDescription, "g"))).toHaveLength(1);
  });

  it("quotes display names and rejects header control characters", () => {
    const message = buildMeetingInviteMessage({
      job: {
        ...job,
        userName: "Patel, Priya"
      },
      admin: {
        ...admin,
        name: "Hiring Team"
      },
      startsAt: new Date("2026-06-16T14:00:00.000Z"),
      durationMinutes: 30,
      message: "Interview details"
    });

    expect(message.data).toContain('To: "Patel, Priya" <priya@example.com.au>');

    expect(() => buildMeetingInviteMessage({
      job: {
        ...job,
        userName: "Priya\r\nBcc: attacker@example.com"
      },
      admin,
      startsAt: new Date("2026-06-16T14:00:00.000Z"),
      durationMinutes: 30,
      message: "Interview details"
    })).toThrow("Email display name contains invalid control characters.");
  });
});
