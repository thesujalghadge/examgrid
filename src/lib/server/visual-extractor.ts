import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";


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

import { spawn } from "node:child_process";
import readline from "node:readline";

export async function* runVisualExtractor(buffer: Buffer, apiKey: string, instituteId: string): AsyncGenerator<unknown, void, unknown> {
  const jobId = Date.now().toString() + Math.floor(Math.random() * 1000).toString();
  const assetDir = path.join(process.cwd(), "public", "uploads", "cbt_assets", instituteId, jobId);
  await fs.mkdir(assetDir, { recursive: true });
  
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "examgrid-vis-"));
  const tempPdf = path.join(tempDir, "paper.pdf");
  await fs.writeFile(tempPdf, buffer);

  const python = await resolveExistingPath(getPythonCandidates());
  const scriptPath = path.join(process.cwd(), "scripts", "pipeline", "orchestrator.py");
  
  yield { status: "Initializing pipeline..." };

  let stderrOutput = "";
  
  try {
    const child = spawn(python, [scriptPath, tempPdf, jobId, apiKey, "--max-pages=3", "--lightweight"]);
    
    child.stderr.on("data", (data) => {
      stderrOutput += data.toString();
    });
    
    const rl = readline.createInterface({
      input: child.stdout,
      crlfDelay: Infinity
    });
    
    for await (const line of rl) {
      if (line.includes("--- Running stage1_render.py ---")) {
         yield { status: "Rendering PDF (Stage 1)..." };
      } else if (line.includes("--- Running stage2_layout.py ---")) {
         yield { status: "Detecting Layout (Stage 2)..." };
      } else if (line.includes("--- Running stage3_ocr.py ---")) {
         yield { status: "OCR Processing (Stage 3)..." };
      } else if (line.includes("--- Running stage4_math.py ---")) {
         yield { status: "Math Extraction (Stage 4)..." };
      } else if (line.includes("--- Running stage6_semantic.py ---")) {
         yield { status: "Semantic Structuring (Stage 5)..." };
      }
    }
    
    const exitCode = await new Promise<number>((resolve, reject) => {
      child.on("close", resolve);
      child.on("error", reject);
    });
    
    if (exitCode !== 0) {
       console.error("[Visual Extractor Stderr]", stderrOutput);
       throw new Error("Pipeline failed with exit code: " + exitCode + ". " + stderrOutput.substring(0, 500));
    }
    
    const semanticPath = path.join(assetDir, "semantic.json");
    try {
      await fs.access(semanticPath);
    } catch {
      throw new Error(`[PIPELINE FAILURE] Semantic generation failed. File not found: ${semanticPath}`);
    }
    
    const semanticStr = await fs.readFile(semanticPath, "utf-8");
    const semanticJson = JSON.parse(semanticStr);
    
    const mappedQuestions = (semanticJson.questions || []).map((q: Record<string, unknown>) => {
      return {
        id: q.id,
        type: q.type,
        subject: q.subject,
        stem: q.stem,
        stemLatex: q.stem,
        options: (Array.isArray(q.options) ? q.options : []).map((optText: unknown, idx: number) => ({
          id: (idx + 1).toString(),
          text: optText,
          latex: optText
        })),
        answer: q.answer,
        confidence: q.confidence,
        images: q.assetPaths || [],
        hasImage: (Array.isArray(q.assetPaths) && q.assetPaths.length > 0),
        _debug_source: "semantic_pipeline_v1",
        _debug_assets: q.assetPaths || []
      };
    });
    
    yield { questions: mappedQuestions };
  } catch (error: unknown) {
    console.error("[Pipeline Error]", error);
    throw error;
  } finally {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

