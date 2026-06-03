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


export function runVisualExtractor(buffer: Buffer, apiKey: string, instituteId: string): Promise<Record<string, unknown>> {
  return new Promise(async (resolve, reject) => {
    let tempDir = "";
    try {
      const jobId = Date.now().toString() + Math.floor(Math.random() * 1000).toString();
      const assetDir = path.join(process.cwd(), "public", "uploads", "cbt_assets", instituteId, jobId);
      await fs.mkdir(assetDir, { recursive: true });
      
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "examgrid-vis-"));
      const tempPdf = path.join(tempDir, "paper.pdf");
      await fs.writeFile(tempPdf, buffer);

      const python = await resolveExistingPath(getPythonCandidates());
      const scriptPath = path.join(process.cwd(), "scripts", "pipeline", "orchestrator.py");
      
      console.log(`\n[RUNTIME PROOF] ORCHESTRATOR INVOKED`);
      console.log(`[RUNTIME PROOF] Starting pipeline for job: ${jobId}`);
      
      const child = spawn(python, [scriptPath, tempPdf, jobId, apiKey, "--max-pages=3", "--lightweight"], {
        stdio: "inherit"
      });
      
      child.on("close", async (code) => {
        if (code !== 0) {
          return reject(new Error(`[PIPELINE FAILURE] Pipeline crashed with exit code ${code}. Check the terminal for raw Python traceback.`));
        }
        
        try {
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
          
          resolve({ questions: mappedQuestions });
        } catch (error) {
          reject(error);
        } finally {
          try {
            if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
          } catch {}
        }
      });
      
      child.on("error", (err) => {
        reject(new Error(`Failed to start subprocess: ${err.message}`));
      });
      
    } catch (error: unknown) {
      console.error("[Pipeline Error]", error);
      reject(error);
    }
  });
}

