import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads", "cbt_assets");
const QUARANTINE_DIR = path.join(process.cwd(), "public", "uploads", ".cleanup-quarantine");

// Helper to calculate directory size
function getDirSize(dirPath: string): number {
  let size = 0;
  if (!fs.existsSync(dirPath)) return 0;
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      size += getDirSize(filePath);
    } else {
      size += stats.size;
    }
  }
  return size;
}

export async function runCleanupJob(options: { dryRun?: boolean } = {}) {
  const { dryRun = false } = options;

  // 1. Create Job Record
  const { data: job, error: jobError } = await supabase
    .from("background_jobs")
    .insert({
      institute_id: "00000000-0000-0000-0000-000000000000", // System level job, or we can query per institute
      job_type: "CLEANUP",
      status: "PROCESSING",
      payload: { dryRun, quarantineHours: 24, deleteHours: 24 }
    })
    .select("id")
    .single();

  if (jobError || !job) {
    console.error("Failed to create CLEANUP job:", jobError);
    return;
  }

  const jobId = job.id;
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  const results = {
    dryRun,
    quarantined: [] as string[],
    deleted: [] as string[],
    protected: [] as { folder: string; reason: string }[],
    bytesFreed: 0,
    bytesQuarantined: 0
  };

  try {
    // Ensure directories exist
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    if (!fs.existsSync(QUARANTINE_DIR)) fs.mkdirSync(QUARANTINE_DIR, { recursive: true });

    // --- STAGE 1: QUARANTINE ELIGIBLE ASSETS ---
    const activeFolders = fs.readdirSync(UPLOADS_DIR);
    for (const folder of activeFolders) {
      const folderPath = path.join(UPLOADS_DIR, folder);
      const stats = fs.statSync(folderPath);
      
      if (!stats.isDirectory()) continue;

      // 1. Age Threshold Check
      const ageMs = now - stats.mtimeMs;
      if (ageMs < ONE_DAY_MS) {
        results.protected.push({ folder, reason: "Folder age < 24 hours" });
        continue;
      }

      // 2. Job Status Check
      const { data: importJobs } = await supabase
        .from("background_jobs")
        .select("status, payload")
        .eq("job_type", "ASSET_IMPORT")
        .contains("payload", { vision_job_id: folder });

      const importJob = importJobs && importJobs.length > 0 ? importJobs[0] : null;

      if (!importJob) {
        results.protected.push({ folder, reason: "No ASSET_IMPORT job found for vision_job_id" });
        continue;
      }

      if (importJob.status !== "COMPLETED") {
        results.protected.push({ folder, reason: `ASSET_IMPORT job is ${importJob.status}, not COMPLETED` });
        continue;
      }

      const examId = importJob.payload.exam_id;
      if (!examId) {
        results.protected.push({ folder, reason: "Job payload missing exam_id" });
        continue;
      }

      // 3. Live Database Verification
      const { count: questionsCount } = await supabase
        .from("exam_questions")
        .select("*", { count: "exact", head: true })
        .eq("exam_id", examId);

      const { data: assets } = await supabase
        .from("test_question_assets")
        .select("asset_status, storage_path")
        .eq("exam_id", examId);

      if (!assets || questionsCount === null) {
        results.protected.push({ folder, reason: "Failed to read live database state" });
        continue;
      }

      const uploadedAssets = assets.filter(a => a.asset_status === "UPLOADED");
      const failedOrPending = assets.filter(a => a.asset_status === "FAILED" || a.asset_status === "PENDING_UPLOAD" || a.asset_status === "UPLOADING");
      const missingStoragePath = uploadedAssets.filter(a => !a.storage_path);

      if (uploadedAssets.length !== questionsCount) {
        results.protected.push({ folder, reason: `Asset count mismatch: ${uploadedAssets.length} UPLOADED vs ${questionsCount} questions` });
        continue;
      }

      if (failedOrPending.length > 0) {
        results.protected.push({ folder, reason: `Contains ${failedOrPending.length} assets not fully UPLOADED` });
        continue;
      }

      if (missingStoragePath.length > 0) {
        results.protected.push({ folder, reason: `Contains ${missingStoragePath.length} UPLOADED assets missing storage_path` });
        continue;
      }

      // All checks passed! Move to Quarantine
      const sizeBytes = getDirSize(folderPath);
      const quarantinePath = path.join(QUARANTINE_DIR, folder);

      if (!dryRun) {
        try {
          fs.renameSync(folderPath, quarantinePath);
          results.quarantined.push(folder);
          results.bytesQuarantined += sizeBytes;
        } catch (e: any) {
          results.protected.push({ folder, reason: `Failed to move to quarantine: ${e.message}` });
        }
      } else {
        results.quarantined.push(folder);
        results.bytesQuarantined += sizeBytes;
      }
    }

    // --- STAGE 2: PERMANENT DELETION FROM QUARANTINE ---
    const quarantineFolders = fs.readdirSync(QUARANTINE_DIR);
    for (const folder of quarantineFolders) {
      const folderPath = path.join(QUARANTINE_DIR, folder);
      const stats = fs.statSync(folderPath);
      
      if (!stats.isDirectory()) continue;

      const ageMs = now - stats.mtimeMs;
      if (ageMs < ONE_DAY_MS) {
        results.protected.push({ folder: `.cleanup-quarantine/${folder}`, reason: "Quarantine age < 24 hours" });
        continue;
      }

      // Eligible for permanent deletion
      const sizeBytes = getDirSize(folderPath);
      if (!dryRun) {
        try {
          fs.rmSync(folderPath, { recursive: true, force: true });
          results.deleted.push(folder);
          results.bytesFreed += sizeBytes;
        } catch (e: any) {
           results.protected.push({ folder: `.cleanup-quarantine/${folder}`, reason: `Failed to delete: ${e.message}` });
        }
      } else {
        results.deleted.push(folder);
        results.bytesFreed += sizeBytes;
      }
    }

    // Finalize Job
    await supabase
      .from("background_jobs")
      .update({
        status: "COMPLETED",
        completed_at: new Date().toISOString(),
        error: JSON.stringify(results) // using error field as results payload per design
      })
      .eq("id", jobId);

    return results;

  } catch (error: any) {
    console.error("Cleanup worker failed:", error);
    await supabase
      .from("background_jobs")
      .update({
        status: "FAILED",
        completed_at: new Date().toISOString(),
        error: error.message || String(error)
      })
      .eq("id", jobId);
    
    throw error;
  }
}
