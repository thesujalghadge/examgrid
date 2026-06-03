import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import os from 'node:os';
import { promises as fs } from 'node:fs';

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

export async function runVerification() {
  console.log('\n[RUNTIME VERIFICATION] Verifying Python Pipeline Dependencies...');
  try {
    const python = await resolveExistingPath(getPythonCandidates());
    const scriptPath = path.join(process.cwd(), 'scripts', 'pipeline', 'orchestrator.py');
    const { stdout } = await execFileAsync(python, [scriptPath, '--verify'], { shell: false });
    console.log(stdout.trim());
  } catch (error: any) {
    console.error('\n[RUNTIME FATAL ERROR] Python pipeline dependency verification failed on server start.');
    if (error.stderr) console.error(error.stderr);
    else if (error.stdout) console.error(error.stdout);
    else console.error(error);
    console.error('Please ensure you have installed the requirements using: pip install -r scripts/pipeline/requirements.txt\n');
    process.exit(1);
  }
}
