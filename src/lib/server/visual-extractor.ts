import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function getPythonCandidates(): string[] {
  const home = os.homedir();
  return [
    process.env.EXAMGRID_BUNDLED_PYTHON ?? "",
    path.join(home, ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "python", "python.exe"),
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

export async function runVisualExtractor(buffer: Buffer, apiKey: string): Promise<any> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "examgrid-vis-"));
  const tempPdf = path.join(tempDir, "paper.pdf");
  await fs.writeFile(tempPdf, buffer);

  const python = await resolveExistingPath(getPythonCandidates());
  const scriptPath = path.join(process.cwd(), "scripts", "visual-extractor.py");

  try {
    const { stdout, stderr } = await execFileAsync(python, [scriptPath, tempPdf, apiKey], {
      maxBuffer: 50 * 1024 * 1024, // 50MB for large json
      shell: true,
    });
    if (stderr) console.error("[Visual Extractor stderr]", stderr);
    
    // Parse the output
    const startIndex = stdout.indexOf('{"questions"');
    const validJsonStr = startIndex >= 0 ? stdout.substring(startIndex) : stdout;
    
    return JSON.parse(validJsonStr);
  } catch (error: any) {
    console.error("[Visual Extractor Error]", error);
    if (error.stderr) console.error("[Visual Extractor Stderr]", error.stderr);
    throw error;
  } finally {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  }
}
