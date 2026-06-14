import { beforeEach, describe, expect, it, vi } from "vitest";

const { extractRawText, pdfParse } = vi.hoisted(() => ({
  extractRawText: vi.fn(),
  pdfParse: vi.fn()
}));

vi.mock("mammoth", () => ({
  default: {
    extractRawText
  }
}));

vi.mock("pdf-parse", () => ({
  default: pdfParse
}));

import { extractResumeText } from "../../src/server/textExtraction.js";

const file = (overrides: Partial<Express.Multer.File>): Express.Multer.File => ({
  fieldname: "resume",
  originalname: "resume.txt",
  encoding: "7bit",
  mimetype: "text/plain",
  size: overrides.buffer?.length ?? 0,
  destination: "",
  filename: "",
  path: "",
  buffer: Buffer.from(""),
  stream: undefined as never,
  ...overrides
});

describe("extractResumeText", () => {
  beforeEach(() => {
    extractRawText.mockReset();
    pdfParse.mockReset();
  });

  it("extracts and cleans PDF text", async () => {
    pdfParse.mockResolvedValueOnce({ text: "PDF\tresume\r\n\r\n\r\ncontent  " });

    await expect(
      extractResumeText(
        file({
          originalname: "resume.pdf",
          mimetype: "application/octet-stream",
          buffer: Buffer.from("pdf")
        })
      )
    ).resolves.toBe("PDF resume\n\ncontent");
    expect(pdfParse).toHaveBeenCalledWith(Buffer.from("pdf"));
  });

  it("extracts and cleans DOCX text", async () => {
    extractRawText.mockResolvedValueOnce({ value: "DOCX\tresume\r\n\r\n\r\ncontent  " });

    await expect(
      extractResumeText(
        file({
          originalname: "resume.bin",
          mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          buffer: Buffer.from("docx")
        })
      )
    ).resolves.toBe("DOCX resume\n\ncontent");
    expect(extractRawText).toHaveBeenCalledWith({ buffer: Buffer.from("docx") });
  });

  it("cleans text and markdown resume uploads", async () => {
    const text = await extractResumeText(
      file({
        originalname: "resume.md",
        mimetype: "text/markdown",
        buffer: Buffer.from("Line 1\r\n\r\n\r\nLine\t\t2  ")
      })
    );

    expect(text).toBe("Line 1\n\nLine 2");
  });

  it("rejects unsupported file types", async () => {
    await expect(
      extractResumeText(
        file({
          originalname: "resume.png",
          mimetype: "image/png",
          buffer: Buffer.from("not text")
        })
      )
    ).rejects.toThrow("Unsupported file type");
  });
});
