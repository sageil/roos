import type { JobRecord, ResumeAnalysis } from "../shared/types.js";

type PdfTextLine = {
  text: string;
  size?: number;
  bold?: boolean;
};

const pageWidth = 612;
const pageHeight = 792;
const margin = 54;
const lineGap = 5;
const headingGap = 9;
const footerSize = 9;

const sanitizePdfText = (value: string | number | undefined): string =>
  String(value ?? "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const escapePdfString = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

const wrapText = (text: string, size: number, maxWidth: number): string[] => {
  const sanitized = sanitizePdfText(text);
  if (!sanitized) {
    return [];
  }

  const maxCharacters = Math.max(18, Math.floor(maxWidth / (size * 0.5)));
  const words = sanitized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharacters) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    if (word.length > maxCharacters) {
      for (let index = 0; index < word.length; index += maxCharacters) {
        lines.push(word.slice(index, index + maxCharacters));
      }
      current = "";
    } else {
      current = word;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
};

const section = (title: string, lines: PdfTextLine[]): PdfTextLine[] => [
  { text: title, size: 13, bold: true },
  ...lines
];

const listLines = (items: string[]): PdfTextLine[] =>
  items.length > 0
    ? items.map((item) => ({ text: `- ${item}` }))
    : [{ text: "No items returned." }];

const analysisLines = (analysis: ResumeAnalysis): PdfTextLine[] => [
  ...section("Candidate Summary", [{ text: analysis.candidateSummary }]),
  ...section("Score Breakdown", [
    { text: `Minimum qualifications: ${Math.round(analysis.scoreBreakdown.minimumQualifications)}/100` },
    { text: `Role competencies: ${Math.round(analysis.scoreBreakdown.roleCompetencies)}/100` },
    { text: `Domain experience: ${Math.round(analysis.scoreBreakdown.domainExperience)}/100` },
    { text: `Preferred qualifications: ${Math.round(analysis.scoreBreakdown.preferredQualifications)}/100` },
    { text: `Seniority and scope: ${Math.round(analysis.scoreBreakdown.seniorityScope)}/100` },
    { text: `Evidence quality: ${Math.round(analysis.scoreBreakdown.evidenceQuality)}/100` }
  ]),
  ...section(
    "Requirement Assessment",
    analysis.requirementAssessments.length > 0
      ? analysis.requirementAssessments.flatMap((requirement) => [
          {
            text: `${requirement.requirement} (${requirement.category}, ${requirement.importance}, ${requirement.status})`,
            bold: true
          },
          { text: requirement.rationale },
          ...requirement.evidence.map((item) => ({ text: `Evidence: ${item}` }))
        ])
      : [{ text: "No requirement assessment returned." }]
  ),
  ...section("Strengths", listLines(analysis.strengths)),
  ...section("Gaps", listLines(analysis.gaps)),
  ...section("Risks", listLines(analysis.risks)),
  ...section("Recommendations", listLines(analysis.recommendations)),
  ...section("Suggested Keywords", listLines(analysis.suggestedKeywords)),
  ...section("Interview Questions", listLines(analysis.interviewQuestions)),
  ...section("Fairness Review", [
    { text: `Ignored factors: ${analysis.fairnessReview.ignoredFactors.join(", ") || "None listed."}` },
    ...listLines(analysis.fairnessReview.notes)
  ]),
  ...section(
    "Ranked Evidence",
    analysis.evidence.length > 0
      ? analysis.evidence.map((chunk) => ({
          text: `Chunk ${chunk.id}, score ${chunk.score}: ${chunk.text}`
        }))
      : [{ text: "No ranked evidence stored." }]
  )
];

export const assessmentPdfFileName = (job: JobRecord): string =>
  `assessment-${job.id}-${sanitizePdfText(job.jobTitle).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "job"}.pdf`;

export const buildAssessmentPdf = (job: JobRecord): Buffer => {
  const analysis = job.analysis;
  if (!analysis) {
    throw new Error("No completed LLM assessment is available for this application.");
  }

  const lines: PdfTextLine[] = [
    { text: "Resume Analyzer LLM Assessment", size: 18, bold: true },
    { text: `Application: ${job.jobTitle}`, size: 13, bold: true },
    { text: `Candidate: ${job.userName ?? "Candidate"}${job.userEmail ? ` <${job.userEmail}>` : ""}` },
    { text: `Date: ${job.applicationDate}` },
    { text: `Status: ${job.status}` },
    { text: `Fit: ${analysis.fitLevel} (${analysis.fitScore}/100)` },
    { text: `Posting: ${job.jobPostingTitle ?? "Custom job profile"}` },
    { text: `LLM model: ${job.llmModel ?? "Not recorded"}` },
    { text: `Embedding model: ${job.embeddingModel ?? "Not recorded"}` },
    ...section("LLM Recommendation", [{ text: job.llmRecommendation || analysis.candidateSummary }]),
    ...analysisLines(analysis),
    ...(job.jobDescription
      ? section("Job Description", [{ text: job.jobDescription }])
      : [])
  ];

  const pages: string[] = [];
  let y = pageHeight - margin;
  let content = "";

  const addPage = () => {
    if (content) {
      pages.push(content);
    }
    content = "";
    y = pageHeight - margin;
  };

  const addText = ({ text, size = 11, bold = false }: PdfTextLine) => {
    const wrapped = wrapText(text, size, pageWidth - margin * 2);
    if (wrapped.length === 0) {
      return;
    }

    if (bold && y < pageHeight - margin) {
      y -= headingGap;
    }

    for (const line of wrapped) {
      if (y < margin + footerSize + 18) {
        addPage();
      }

      content += `BT /${bold ? "F2" : "F1"} ${size} Tf ${margin} ${y} Td (${escapePdfString(line)}) Tj ET\n`;
      y -= size + lineGap;
    }
  };

  for (const line of lines) {
    addText(line);
  }
  addPage();

  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const catalogObject = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesObject = addObject("");
  const fontObject = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldFontObject = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageObjects: number[] = [];

  for (const [index, pageContent] of pages.entries()) {
    const footer = `BT /F1 ${footerSize} Tf ${margin} ${margin - 24} Td (Page ${index + 1} of ${pages.length}) Tj ET\n`;
    const stream = `${pageContent}${footer}`;
    const streamObject = addObject(`<< /Length ${Buffer.byteLength(stream, "binary")} >>\nstream\n${stream}endstream`);
    const pageObject = addObject(
      `<< /Type /Page /Parent ${pagesObject} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontObject} 0 R /F2 ${boldFontObject} 0 R >> >> /Contents ${streamObject} 0 R >>`
    );
    pageObjects.push(pageObject);
  }

  objects[pagesObject - 1] = `<< /Type /Pages /Kids [${pageObjects.map((objectId) => `${objectId} 0 R`).join(" ")}] /Count ${pageObjects.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf, "binary"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "binary");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObject} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "binary");
};
