import { createClient } from "@supabase/supabase-js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs/promises";
import "dotenv/config";

const execFileAsync = promisify(execFile);
const isJson = process.argv.includes("--json");

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

interface CheckResult {
  category: string;
  name: string;
  status: "pass" | "fail" | "warn";
  message: string;
}

const results: CheckResult[] = [];
let currentCategory = "General";

function setCategory(name: string, icon: string) {
  currentCategory = name;
  if (!isJson) {
    console.log(`\n${icon} ${colors.bold}${name}${colors.reset}`);
  }
}

function pushResult(status: "pass" | "fail" | "warn", name: string, message: string) {
  results.push({ category: currentCategory, name, status, message });
  if (!isJson) {
    if (status === "pass") console.log(`  ${colors.green}✅ PASS${colors.reset}  ${message}`);
    else if (status === "fail") console.log(`  ${colors.red}❌ FAIL${colors.reset}  ${message}`);
    else if (status === "warn") console.log(`  ${colors.yellow}⚠️ WARN${colors.reset}  ${message}`);
  }
}

function pass(name: string, message: string = name) { pushResult("pass", name, message); }
function fail(name: string, message: string = name) { pushResult("fail", name, message); }
function warn(name: string, message: string = name) { pushResult("warn", name, message); }

async function resolvePython(): Promise<string> {
  const candidates = [
    process.env.EXAMGRID_BUNDLED_PYTHON ?? "",
    path.join(process.cwd(), ".venv", "Scripts", "python.exe"),
    path.join(process.cwd(), "venv", "Scripts", "python.exe"),
    "python",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate === "python") return candidate;
    try {
      await fs.access(candidate);
      return candidate;
    } catch { continue; }
  }
  return "python";
}

async function runDoctor() {
  if (!isJson) {
    console.log(`\n${colors.cyan}═══════════════════════════════════════════════`);
    console.log(`         ExamGrid System Health Doctor`);
    console.log(`═══════════════════════════════════════════════${colors.reset}\n`);
  }

  // 1. Environment Variables
  setCategory("Environment Variables", "📦");
  const requiredEnvVars = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  for (const env of requiredEnvVars) {
    if (process.env[env]) pass(`${env} is configured`);
    else fail(`${env} is missing`);
  }

  if (process.env["SESSION_SECRET"]) pass(`SESSION_SECRET is configured`);
  else warn(`SESSION_SECRET is missing (using default fallback)`);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    if (!isJson) console.error(`\n${colors.red}FATAL: Cannot continue without Supabase credentials.${colors.reset}`);
    process.exit(1);
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // 2. Database & Migrations
  setCategory("Database & Migrations", "🗄️");
  try {
    const { error: dbError } = await supabase.from("students").select("id").limit(1);
    if (dbError) throw dbError;
    pass("Database is reachable and students table exists");

    const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
    const migrationFiles = await fs.readdir(migrationsDir).catch(() => []);
    const timestamps = migrationFiles.filter(f => f.endsWith(".sql")).map(f => f.split("_")[0]);
    const duplicates = timestamps.filter((t, index) => timestamps.indexOf(t) !== index);
    
    if (duplicates.length > 0) {
      fail(`Duplicate migrations detected: ${duplicates.join(", ")}`);
    } else {
      pass(`Migration history is clean (${timestamps.length} files)`);
    }
  } catch (err: any) {
    fail("Database unreachable or missing tables", err.message);
  }

  // 3. Identity Invariants & RPCs
  setCategory("RPC Signatures & Identity", "🔐");
  try {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`;
    const r = await fetch(url, { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY! } });
    const openapi = await r.json();

    if (openapi) {
      pass("OpenAPI introspection successful");
      
      const studentIdType = openapi.definitions?.students?.properties?.id?.format;
      if (studentIdType === "uuid") pass("Identity invariant OK: student.id is UUID");
      else fail(`Identity invariant broken: student.id format is ${studentIdType}`);

      const checkRpc = (rpcName: string, paramName: string, expectedType: string, mustNotExist = false) => {
        const argsParam = openapi.paths[`/rpc/${rpcName}`]?.post?.parameters?.find((x: any) => x.name === "args");
        const schemaProps = argsParam?.schema?.properties || {};
        const p = schemaProps[paramName];
        if (mustNotExist) {
          if (p) fail(`Identity invariant broken: RPC ${rpcName} expects legacy parameter ${paramName}`);
          else pass(`Identity invariant OK: RPC ${rpcName} does not depend on ${paramName}`);
        } else {
          if (!p) fail(`RPC ${rpcName} missing required parameter ${paramName}`);
          else pass(`RPC signature matches: ${rpcName} accepts ${paramName} (${expectedType})`);
        }
      };

      checkRpc("submit_cbt_attempt", "p_student_id", "uuid");
      checkRpc("submit_cbt_attempt", "p_student_roll_number", "any", true);
      checkRpc("get_cbt_submission", "p_student_id", "uuid");
      checkRpc("get_cbt_submission", "p_student_roll_number", "any", true);
    }
  } catch (err: any) {
    fail("OpenAPI introspection failed", err.message);
  }

  // 4. Storage Buckets
  setCategory("Storage Buckets", "🪣");
  const REQUIRED_BUCKETS = ["cbt_assets", "solutions"];
  try {
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    if (bucketError) throw bucketError;
    const bucketNames = buckets.map(b => b.name);
    for (const rb of REQUIRED_BUCKETS) {
      if (bucketNames.includes(rb)) pass(`Bucket '${rb}' exists`);
      else fail(`Bucket '${rb}' is missing. (Available: ${bucketNames.join(", ") || "none"})`);
    }
  } catch (err: any) {
    fail("Failed to list storage buckets", err.message);
  }

  // 5. Background Workers & Queues
  setCategory("Background Workers & Queues", "⚙️");
  try {
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    
    const { data: stuckAnal } = await supabase.from('analytics_jobs').select('id').eq('status', 'PROCESSING').lt('updated_at', oneHourAgo);
    if (stuckAnal && stuckAnal.length > 0) warn(`Found ${stuckAnal.length} analytics jobs stuck PROCESSING for > 1hr`);
    else pass("No stuck analytics jobs");

    const { data: stuckSol } = await supabase.from('solution_generation_queue').select('id').eq('status', 'PROCESSING').lt('updated_at', oneHourAgo);
    if (stuckSol && stuckSol.length > 0) warn(`Found ${stuckSol.length} solution jobs stuck PROCESSING for > 1hr`);
    else pass("No stuck solution generation jobs");

    const { data: noWorker } = await supabase.from('solution_generation_queue').select('id').eq('status', 'PENDING').lt('updated_at', oneHourAgo);
    if (noWorker && noWorker.length > 0) warn(`Found ${noWorker.length} solution jobs waiting PENDING for > 1hr (workers down?)`);
    else pass("No chronically pending solution jobs");

  } catch (err: any) {
    warn(`Failed to query background workers state: ${err.message}`);
  }

  // 6. Python Environment
  setCategory("Python Runtime", "🐍");
  try {
    const pythonExe = await resolvePython();
    const { stdout: pyVer } = await execFileAsync(pythonExe, ["-c", "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"]);
    const [major, minor] = pyVer.trim().split(".").map(Number);
    
    if (major < 3 || (major === 3 && minor < 11)) fail(`Python ${major}.${minor} detected. Minimum supported: 3.11`);
    else pass(`Python ${major}.${minor} detected`);

    const scriptPath = path.join(process.cwd(), "scripts", "pipeline", "vision_orchestrator.py");
    const { stdout } = await execFileAsync(pythonExe, [scriptPath, "--verify"], { shell: false });
    pass(`Python dependency verification script passed`);
    
    const lines = stdout.trim().split("\n");
    for (const line of lines) {
      if (line.includes("✓")) pass(line.replace("✓ ", "").trim() + " is installed");
    }
  } catch (err: any) {
    fail(`Python dependency check failed`, err.stdout ? err.stdout.trim() : err.message);
  }

  // 7. AI Provider Verification
  setCategory("AI Provider", "🧠");
  if (!process.env.GEMINI_API_KEY) {
    warn("GEMINI_API_KEY is missing (AI features will be disabled)");
  } else {
    try {
      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
      if (geminiRes.ok) {
        pass("Gemini API key is valid and service is reachable");
      } else {
        warn(`Gemini API request failed with status ${geminiRes.status} (Is the key valid?)`);
      }
    } catch (err: any) {
      warn(`Failed to contact Gemini API: ${err.message}`);
    }
  }

  // Determine Final Status
  const criticalCount = results.filter(r => r.status === "fail").length;
  const warningCount = results.filter(r => r.status === "warn").length;

  let finalStatus = "ready";
  if (criticalCount > 0) finalStatus = "critical";
  else if (warningCount > 0) finalStatus = "warning";

  if (isJson) {
    console.log(JSON.stringify({ status: finalStatus, checks: results }, null, 2));
    process.exit(criticalCount > 0 ? 1 : 0);
  }

  console.log(`\n${colors.cyan}═══════════════════════════════════════════════`);
  console.log(`  Health Check Summary`);
  console.log(`═══════════════════════════════════════════════${colors.reset}`);
  
  if (finalStatus === "critical") {
    console.log(`\n  ${colors.red}🔴 Critical issues (${criticalCount}). Fix infrastructure before continuing.${colors.reset}\n`);
    process.exit(1);
  } else if (finalStatus === "warning") {
    console.log(`\n  ${colors.yellow}🟡 Development OK, deployment blocked. Resolve warnings (${warningCount}) when possible.${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`\n  ${colors.green}🟢 Ready for development. System is healthy.${colors.reset}\n`);
    process.exit(0);
  }
}

runDoctor().catch((err) => {
  if (isJson) {
    console.log(JSON.stringify({ status: "critical", error: err.message }));
  } else {
    console.error(`\n${colors.red}FATAL ERROR RUNNING DOCTOR SCRIPT:${colors.reset}\n`, err);
  }
  process.exit(1);
});
