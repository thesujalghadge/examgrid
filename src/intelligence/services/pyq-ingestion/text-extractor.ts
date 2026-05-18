import { readSourceFile } from "@/intelligence/services/pyq-ingestion/file-storage";

/**
 * Extract plain text from uploaded PYQ sources.
 * PDF uses dynamic import so Next.js build stays optional-deps friendly.
 */
export async function extractTextFromSource(
  storagePath: string,
  mimeType: string,
): Promise<string> {
  const buffer = await readSourceFile(storagePath);

  if (mimeType === "text/plain" || storagePath.endsWith(".txt")) {
    return buffer.toString("utf8");
  }

  if (
    mimeType === "application/pdf" ||
    storagePath.toLowerCase().endsWith(".pdf")
  ) {
    return extractPdfText(buffer);
  }

  if (
    mimeType.includes("word") ||
    storagePath.toLowerCase().endsWith(".docx")
  ) {
    return extractDocxPlaceholder(buffer);
  }

  return buffer.toString("utf8");
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const mod = await import("pdf-parse");
    const pdfParse = mod.default ?? mod;
    const result = await pdfParse(buffer);
    return (result.text ?? "").trim();
  } catch {
    return [
      "[PDF text extraction pending — ensure pdf-parse is installed and REDIS worker is running]",
      `Binary size: ${buffer.length} bytes`,
    ].join("\n");
  }
}

function extractDocxPlaceholder(buffer: Buffer): string {
  return [
    "[DOCX parser placeholder — integrate mammoth/docx parser in a future pass]",
    `Binary size: ${buffer.length} bytes`,
  ].join("\n");
}

export function chunkExtractedText(
  text: string,
  maxChunkSize = 12000,
): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const chunks: string[] = [];
  let offset = 0;
  while (offset < normalized.length) {
    chunks.push(normalized.slice(offset, offset + maxChunkSize));
    offset += maxChunkSize;
  }
  return chunks;
}
