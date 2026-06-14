import mammoth from "mammoth";
import pdfParse from "pdf-parse";

const cleanText = (text: string): string =>
  text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export const extractResumeText = async (file: Express.Multer.File): Promise<string> => {
  const lowerName = file.originalname.toLowerCase();

  if (file.mimetype === "application/pdf" || lowerName.endsWith(".pdf")) {
    const parsed = await pdfParse(file.buffer);
    return cleanText(parsed.text);
  }

  if (
    file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx")
  ) {
    const parsed = await mammoth.extractRawText({ buffer: file.buffer });
    return cleanText(parsed.value);
  }

  if (
    file.mimetype.startsWith("text/") ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md")
  ) {
    return cleanText(file.buffer.toString("utf8"));
  }

  throw new Error("Unsupported file type. Upload a PDF, DOCX, TXT, or Markdown resume.");
};
