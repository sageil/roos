import { describe, expect, it } from "vitest";
import type { JobRecord, ResumeAnalysis } from "../../src/shared/types.js";
import { assessmentPdfFileName, buildAssessmentPdf } from "../../src/server/assessmentPdf.js";

const analysis: ResumeAnalysis = {
  candidateSummary: "Strong veterinary technician fit with direct anaesthetic monitoring, patient handling, and clinical records evidence.",
  fitScore: 84,
  fitLevel: "high",
  strengths: ["Anaesthetic monitoring", "Patient handling"],
  gaps: ["Confirm radiography workflow depth"],
  risks: ["Emergency stabilisation exposure should be verified"],
  recommendations: ["Lead with anaesthetic monitoring and treatment-note accuracy."],
  suggestedKeywords: ["anaesthetic monitoring", "patient handling", "clinical records"],
  interviewQuestions: ["Which anaesthetic monitoring responsibilities did you own?"],
  requirementAssessments: [
    {
      category: "role_competency",
      requirement: "Support anaesthetic monitoring and accurate clinical records",
      importance: "must_have",
      status: "met",
      evidence: ["Seven years across patient handling and anaesthetic monitoring."],
      rationale: "The resume directly supports the core veterinary technician requirement."
    }
  ],
  scoreBreakdown: {
    minimumQualifications: 86,
    roleCompetencies: 88,
    domainExperience: 80,
    preferredQualifications: 72,
    seniorityScope: 78,
    evidenceQuality: 84
  },
  fairnessReview: {
    ignoredFactors: ["name"],
    notes: ["Assessment used job-related evidence only."]
  },
  evidence: [
    {
      id: 1,
      text: "Veterinary technician experience across anaesthetic monitoring, patient restraint, clinical records, and treatment notes.",
      score: 0.87
    }
  ]
};

const job: JobRecord = {
  id: 42,
  userId: 7,
  userName: "Olivia Harris",
  userEmail: "olivia@example.com.au",
  status: "completed",
  applicationDate: "2026-06-14",
  jobTitle: "Veterinary Technician",
  jobPostingTitle: "Veterinary Technician - Companion Animal Clinic",
  jobDescription: "Support patient restraint, anaesthetic monitoring, treatment notes, and clinical handoffs.",
  resumeFileName: "resume.md",
  characterCount: 2400,
  chunkCount: 2,
  llmRecommendation: "Strong fit for veterinary technician support.",
  analysis,
  fitScore: 84,
  fitLevel: "high",
  llmModel: "local-llm",
  embeddingModel: "embedding-model",
  createdAt: "2026-06-14T12:00:00.000Z",
  updatedAt: "2026-06-14T12:05:00.000Z"
};

describe("assessmentPdf", () => {
  it("builds a PDF buffer from a completed assessment", () => {
    const pdf = buildAssessmentPdf(job);
    const text = pdf.toString("latin1");

    expect(pdf.length).toBeGreaterThan(1000);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("Resume Analyzer LLM Assessment");
    expect(text).toContain("Strong fit for veterinary technician support.");
    expect(text).toContain("startxref");
  });

  it("builds a safe file name from the job title", () => {
    expect(assessmentPdfFileName(job)).toBe("assessment-42-veterinary-technician.pdf");
  });

  it("rejects jobs without a stored analysis", () => {
    expect(() => buildAssessmentPdf({ ...job, analysis: undefined })).toThrow(
      "No completed LLM assessment is available"
    );
  });
});
