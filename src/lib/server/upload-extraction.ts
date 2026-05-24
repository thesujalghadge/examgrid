import "server-only";

import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type {
  PaperExtractionSummary,
  SupportedPaperFileType,
} from "@/types/cbt-paper-processing";

const execFileAsync = promisify(execFile);
const MIN_PDF_TEXT_CHARS = 120;
const SCANNED_DOCUMENT_WARNING =
  "We detected a scanned or complex document. Please review extracted content before publishing.";

interface UploadExtractionResult {
  text: string;
  summary: Omit<PaperExtractionSummary, "questionsDetected">;
}

function normalizeText(text: string): string {
  return text
    .replace(/\u0000/g, " ")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[^\S\n]+/g, " ")
    .trim();
}

function getPythonCandidates(): string[] {
  const home = os.homedir();
  return [
    process.env.EXAMGRID_BUNDLED_PYTHON ?? "",
    path.join(
      home,
      ".cache",
      "codex-runtimes",
      "codex-primary-runtime",
      "dependencies",
      "python",
      "python.exe",
    ),
    "python",
  ].filter(Boolean);
}

async function resolveExistingPath(candidates: string[]): Promise<string> {
  for (const candidate of candidates) {
    if (candidate === "python") return candidate;
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }
  return "python";
}

async function createTempFile(fileName: string, bytes: Buffer): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "examgrid-upload-"));
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const targetPath = path.join(tempDir, safeName);
  await fs.writeFile(targetPath, bytes);
  return targetPath;
}

async function removeTempFile(filePath: string): Promise<void> {
  try {
    await fs.rm(path.dirname(filePath), { recursive: true, force: true });
  } catch {
    // Best-effort cleanup only.
  }
}

function extractPrintableText(bytes: Buffer): string {
  const decoded = bytes.toString("latin1");
  const matches = decoded.match(/[A-Za-z0-9][A-Za-z0-9 .,:;(){}\[\]\/%+\-='"?!]{3,}/g) ?? [];
  return normalizeText(matches.join("\n"));
}

async function runPythonScript(script: string, filePath: string): Promise<{ text: string; pages: number }> {
  const python = await resolveExistingPath(getPythonCandidates());
  const { stdout } = await execFileAsync(
    python,
    ["-c", script, filePath],
    { windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
  );
  const parsed = JSON.parse(stdout.trim()) as { text?: string; pages?: number };
  return {
    text: normalizeText(parsed.text ?? ""),
    pages: Number(parsed.pages ?? 1) || 1,
  };
}

async function extractPdf(filePath: string, bytes: Buffer): Promise<UploadExtractionResult> {
  const result = await runPythonScript(
    [
      "import json, sys",
      "from pypdf import PdfReader",
      "reader = PdfReader(sys.argv[1])",
      "texts = [(page.extract_text() or '') for page in reader.pages]",
      "print(json.dumps({'text': '\\n'.join(texts), 'pages': len(reader.pages)}))",
    ].join("\n"),
    filePath,
  );

  const warnings: string[] = [];
  let usedOCR = false;
  let text = result.text;
  if (text.length < MIN_PDF_TEXT_CHARS) {
    usedOCR = true;
    const fallbackText = extractPrintableText(bytes);
    if (fallbackText.length > text.length) {
      text = fallbackText;
    }
    warnings.push(SCANNED_DOCUMENT_WARNING);
  }

  return {
    text,
    summary: {
      pages: Math.max(1, result.pages),
      extractedChars: text.length,
      usedOCR,
      warnings,
    },
  };
}

async function extractDocx(filePath: string): Promise<UploadExtractionResult> {
  const result = await runPythonScript(
    [
      "import json, sys",
      "from docx import Document",
      "doc = Document(sys.argv[1])",
      "parts = [p.text for p in doc.paragraphs if p.text.strip()]",
      "for table in doc.tables:",
      "  for row in table.rows:",
      "    cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]",
      "    if cells: parts.append(' | '.join(cells))",
      "print(json.dumps({'text': '\\n'.join(parts), 'pages': max(1, len(parts))}))",
    ].join("\n"),
    filePath,
  );

  return {
    text: result.text,
    summary: {
      pages: 1,
      extractedChars: result.text.length,
      usedOCR: false,
      warnings: result.text.length < 80 ? [SCANNED_DOCUMENT_WARNING] : [],
    },
  };
}

async function extractXlsx(filePath: string): Promise<UploadExtractionResult> {
  const result = await runPythonScript(
    [
      "import json, sys",
      "from openpyxl import load_workbook",
      "wb = load_workbook(sys.argv[1], data_only=True, read_only=True)",
      "parts = []",
      "for sheet in wb.worksheets:",
      "  parts.append(f'Sheet: {sheet.title}')",
      "  for row in sheet.iter_rows(values_only=True):",
      "    values = [str(v).strip() for v in row if v is not None and str(v).strip()]",
      "    if values: parts.append(' | '.join(values))",
      "print(json.dumps({'text': '\\n'.join(parts), 'pages': len(wb.worksheets)}))",
    ].join("\n"),
    filePath,
  );

  return {
    text: result.text,
    summary: {
      pages: Math.max(1, result.pages),
      extractedChars: result.text.length,
      usedOCR: false,
      warnings: [],
    },
  };
}

function extractPlainText(bytes: Buffer): UploadExtractionResult {
  const text = normalizeText(bytes.toString("utf8"));
  return {
    text,
    summary: {
      pages: 1,
      extractedChars: text.length,
      usedOCR: false,
      warnings: [],
    },
  };
}

function extractLegacyDoc(bytes: Buffer): UploadExtractionResult {
  const text = extractPrintableText(bytes);
  const warnings = [SCANNED_DOCUMENT_WARNING];
  return {
    text,
    summary: {
      pages: 1,
      extractedChars: text.length,
      usedOCR: true,
      warnings,
    },
  };
}

export async function extractUploadContent(input: {
  fileName: string;
  fileType: SupportedPaperFileType;
  bytes: Buffer;
}): Promise<UploadExtractionResult> {
  if (input.fileType === "txt" || input.fileType === "csv") {
    return extractPlainText(input.bytes);
  }
  if (input.fileType === "doc") {
    return extractLegacyDoc(input.bytes);
  }

  const tempPath = await createTempFile(input.fileName, input.bytes);
  try {
    if (input.fileType === "pdf") {
      return await extractPdf(tempPath, input.bytes);
    }
    if (input.fileType === "docx") {
      return await extractDocx(tempPath);
    }
    if (input.fileType === "xlsx") {
      return await extractXlsx(tempPath);
    }
    return extractPlainText(input.bytes);
  } finally {
    await removeTempFile(tempPath);
  }
}

export { SCANNED_DOCUMENT_WARNING };
