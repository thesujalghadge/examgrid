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

export async function runVisualExtractor(buffer: Buffer, apiKey: string, instituteId: string): Promise<any> {
  const jobId = Date.now().toString() + Math.floor(Math.random() * 1000).toString();
  const assetDir = path.join(process.cwd(), "public", "uploads", "cbt_assets", instituteId, jobId);
  await fs.mkdir(assetDir, { recursive: true });
  const assetUrlPrefix = `/uploads/cbt_assets/${instituteId}/${jobId}`;
  
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "examgrid-vis-"));
  const tempPdf = path.join(tempDir, "paper.pdf");
  await fs.writeFile(tempPdf, buffer);

  const python = await resolveExistingPath(getPythonCandidates());
  const scriptPath = path.join(process.cwd(), "scripts", "pipeline", "orchestrator.py");
  
  console.log(`[Runtime Audit Boundary 1] Starting pipeline for job: ${jobId}`);

  try {
    const { stdout, stderr } = await execFileAsync(python, [scriptPath, tempPdf, jobId, apiKey], {
      maxBuffer: 50 * 1024 * 1024, // 50MB for large json
      shell: false,
    });
    if (stderr) console.error("[Pipeline stderr]", stderr);
    console.log(`[Runtime Audit Boundary 2] Python pipeline finished. Stdout length: ${stdout.length}`);
    
    // Read the output from the generated semantic.json
    const semanticPath = path.join(assetDir, "semantic.json");
    console.log(`[Runtime Audit Boundary 3] Reading semantic JSON from: ${semanticPath}`);
    const semanticStr = await fs.readFile(semanticPath, "utf-8");
    const semanticJson = JSON.parse(semanticStr);
    
    console.log(`[Runtime Audit Boundary 4] Semantic JSON parsed. Found ${(semanticJson.questions || []).length} questions.`);
    
    // Map new semantic format to legacy frontend schema to prevent React rewrite
    const mappedQuestions = (semanticJson.questions || []).map((q: any) => {
      return {
        id: q.id,
        type: q.type,
        subject: q.subject,
        stem: q.stem,
        stemLatex: q.stem, // map both for legacy compatibility
        options: (q.options || []).map((optText: string, idx: number) => ({
          id: (idx + 1).toString(),
          text: optText,
          latex: optText
        })),
        answer: q.answer,
        confidence: q.confidence,
        images: q.assetPaths || [], // send visual crops to legacy images array
        hasImage: (q.assetPaths && q.assetPaths.length > 0),
        _debug_source: "semantic_pipeline_v1",
        _debug_assets: q.assetPaths || []
      };
    });
    
    console.log(`[Runtime Audit Boundary 5] Mapped questions for CBT. Sample Q1 AssetPaths:`, mappedQuestions[0]?.images);
    
    return { questions: mappedQuestions };
  } catch (error: any) {
    console.error("[Pipeline Error]", error);
    if (error.stderr) console.error("[Visual Extractor Stderr]", error.stderr);
    throw error;
  } finally {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  }
}
