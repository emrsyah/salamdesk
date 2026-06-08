import { LiteParse } from "@llamaindex/liteparse";
import mammoth from "mammoth";
import { readFile } from "node:fs/promises";
import path from "node:path";

export type ExtractedKnowledgeDocument = {
  text: string;
  pages?: Array<{ pageNumber: number; text: string }>;
};

function getFileExtension(fileName: string) {
  return path.extname(fileName).toLowerCase();
}

function isDocx(input: { mimeType: string; fileName: string }) {
  return (
    input.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    getFileExtension(input.fileName) === ".docx"
  );
}

function isPdf(input: { mimeType: string; fileName: string }) {
  return input.mimeType === "application/pdf" || getFileExtension(input.fileName) === ".pdf";
}

function isPlainText(input: { mimeType: string; fileName: string }) {
  const extension = getFileExtension(input.fileName);
  return (
    input.mimeType.startsWith("text/") ||
    ["", ".txt", ".md", ".markdown"].includes(extension)
  );
}

export async function extractKnowledgeDocument(input: {
  filePath: string;
  mimeType: string;
  fileName: string;
}): Promise<ExtractedKnowledgeDocument> {
  if (isPdf(input)) {
    const parser = new LiteParse({ ocrEnabled: true });
    const result = await parser.parse(input.filePath);
    const pages = result.pages?.map((page) => ({
      pageNumber: page.pageNum,
      text: page.textItems.map((item) => "text" in item ? item.text : item.str).join(" ").trim(),
    })).filter((page) => page.text.length > 0);

    return {
      text: result.text.trim(),
      pages: pages.length > 0 ? pages : undefined,
    };
  }

  if (isDocx(input)) {
    const result = await mammoth.extractRawText({ path: input.filePath });
    return { text: result.value.trim() };
  }

  if (isPlainText(input)) {
    const text = await readFile(input.filePath, "utf8");
    return { text: text.trim() };
  }

  throw new Error(`Unsupported knowledge document type: ${input.mimeType || input.fileName}`);
}
