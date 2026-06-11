import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = "cbt-assets";

interface PreparedAsset {
  fileBuffer: Buffer;
  mimeType: string;
  extension: string;
  contentHash: string;
  fileSizeBytes: number;
}

/**
 * Abstracts the local file loading and format conversion.
 * Currently just reads the file. Will easily support WEBP conversion later via sharp.
 */
async function prepareAssetForUpload(localPath: string): Promise<PreparedAsset> {
  if (!fs.existsSync(localPath)) {
    throw new Error(`File not found: ${localPath}`);
  }
  const fileBuffer = fs.readFileSync(localPath);
  if (fileBuffer.length === 0) {
    throw new Error(`Corrupt/Empty image file: ${localPath}`);
  }
  
  const contentHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
  const ext = path.extname(localPath).toLowerCase();
  
  let mimeType = "image/jpeg";
  if (ext === ".png") mimeType = "image/png";
  if (ext === ".webp") mimeType = "image/webp";

  return {
    fileBuffer,
    mimeType,
    extension: ext || ".jpg",
    contentHash,
    fileSizeBytes: fileBuffer.length
  };
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function runAssetImportJob(jobId: string) {
  // 1. Fetch Job
  const { data: job, error: jobError } = await supabase
    .from("background_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (jobError || !job) {
    console.error(`Job ${jobId} not found or error:`, jobError);
    return;
  }

  if (job.status !== "PENDING" && job.status !== "FAILED" && job.status !== "PARTIAL_SUCCESS") {
    console.warn(`Job ${jobId} is not in a runnable state (status: ${job.status}).`);
    return;
  }

  // Lock job
  await supabase
    .from("background_jobs")
    .update({ status: "PROCESSING", started_at: new Date().toISOString() })
    .eq("id", jobId);

  const payload = job.payload;
  const examId = payload.exam_id;
  const visionJobId = payload.vision_job_id;
  
  let uploaded = 0;
  let failed = 0;
  let skipped = 0;

  try {
    // 2. Fetch exam_questions
    const { data: questions, error: questionsError } = await supabase
      .from("exam_questions")
      .select("id, question_number, metadata")
      .eq("exam_id", examId);

    if (questionsError || !questions) {
      throw new Error(`Failed to fetch exam_questions for exam ${examId}`);
    }

    const totalQuestions = questions.length;

    // 3. Ensure test_question_assets exists (PENDING_UPLOAD)
    for (const q of questions) {
      await supabase
        .from("test_question_assets")
        .insert({
          exam_question_id: q.id,
          exam_id: examId,
          question_number: q.question_number,
          image_url: "",
          asset_status: "PENDING_UPLOAD",
          institute_id: job.institute_id
        })
        .select("id")
        .maybeSingle(); 
      // Ignores ON CONFLICT failures natively if row already exists
    }

    // 4. Read crops_meta and Upload it FIRST
    const cropsMetaPath = path.join(process.cwd(), "public", "uploads", "cbt_assets", visionJobId, "crops_meta.json");
    let cropsData: any = { questions: [] };
    
    if (!fs.existsSync(cropsMetaPath)) {
      throw new Error(`crops_meta.json not found for job ${visionJobId} at ${cropsMetaPath}`);
    }

    const cropsMetaBuffer = fs.readFileSync(cropsMetaPath);
    cropsData = JSON.parse(cropsMetaBuffer.toString("utf8"));

    const systemMetaPath = `${job.institute_id}/${examId}/system-metadata/crops_meta.json`;
    await supabase.storage.from(BUCKET_NAME).upload(systemMetaPath, cropsMetaBuffer, { upsert: true, contentType: "application/json" });

    // O(1) mapping
    const cropsByVisionId = new Map();
    if (cropsData && cropsData.questions) {
      cropsData.questions.forEach((c: any) => {
        cropsByVisionId.set(c.vision_question_id || c.id, c);
      });
    }

    // 5. Map vision_question_id & Upload Asset
    for (const q of questions) {
      // Check current status to skip if already UPLOADED (Idempotency)
      const { data: currentAsset } = await supabase
        .from("test_question_assets")
        .select("asset_status, upload_attempts")
        .eq("exam_question_id", q.id)
        .single();
      
      if (currentAsset?.asset_status === "UPLOADED") {
        skipped++;
        continue;
      }

      await supabase
        .from("test_question_assets")
        .update({ asset_status: "UPLOADING" })
        .eq("exam_question_id", q.id);

      const metadata = q.metadata || {};
      const visionId = metadata.vision_question_id;

      if (!visionId) {
        await supabase.from("test_question_assets").update({ asset_status: "FAILED" }).eq("exam_question_id", q.id);
        failed++;
        continue;
      }

      const crop = cropsByVisionId.get(visionId);
      if (!crop || !crop.crop_path) {
        await supabase.from("test_question_assets").update({ asset_status: "FAILED" }).eq("exam_question_id", q.id);
        failed++;
        continue;
      }

      let attempts = currentAsset?.upload_attempts || 0;
      let success = false;
      let finalError = "";

      try {
        const prepared = await prepareAssetForUpload(crop.crop_path);
        const deterministicPath = `${job.institute_id}/${examId}/questions/${q.id}${prepared.extension}`;

        // Retry Loop (max 3 attempts)
        while (attempts < 3 && !success) {
          attempts++;
          try {
            // 1. Upload
            const { error: uploadError } = await supabase.storage
              .from(BUCKET_NAME)
              .upload(deterministicPath, prepared.fileBuffer, {
                contentType: prepared.mimeType,
                upsert: true
              });

            if (uploadError) throw uploadError;

            // 2. Object Exists & Size Verification
            // Supabase does not have HEAD, but we can list the directory and match the file size.
            const dirPath = `${job.institute_id}/${examId}/questions`;
            const fileName = `${q.id}${prepared.extension}`;
            const { data: listData, error: listError } = await supabase.storage
              .from(BUCKET_NAME)
              .list(dirPath, { search: fileName, limit: 1 });

            if (listError) throw listError;
            
            const fileObj = listData?.find(f => f.name === fileName);
            if (!fileObj) throw new Error("File missing in storage bucket list after upload");
            
            // Check size matching (Supabase returns file size in metadata object)
            if (fileObj.metadata?.size !== prepared.fileSizeBytes) {
              throw new Error(`Size mismatch: expected ${prepared.fileSizeBytes}, got ${fileObj.metadata?.size}`);
            }

            // 3. Mark UPLOADED
            const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(deterministicPath);

            await supabase
              .from("test_question_assets")
              .update({ 
                asset_status: "UPLOADED", 
                storage_path: deterministicPath,
                image_url: publicUrlData.publicUrl,
                content_hash: prepared.contentHash,
                file_size_bytes: prepared.fileSizeBytes,
                uploaded_at: new Date().toISOString(),
                upload_attempts: attempts
              })
              .eq("exam_question_id", q.id);
            
            success = true;
            uploaded++;

          } catch (err: any) {
            console.error(`Upload attempt ${attempts} failed for ${q.id}:`, err);
            finalError = err.message || String(err);
            if (attempts < 3) {
              await sleep(attempts === 1 ? 1000 : 3000);
            }
          }
        }

        if (!success) {
          await supabase
            .from("test_question_assets")
            .update({ asset_status: "FAILED", upload_attempts: attempts })
            .eq("exam_question_id", q.id);
          failed++;
        }

      } catch (prepError: any) {
        console.error(`Preparation failed for ${q.id}:`, prepError);
        await supabase
          .from("test_question_assets")
          .update({ asset_status: "FAILED", upload_attempts: attempts })
          .eq("exam_question_id", q.id);
        failed++;
      }
    }

    // 6. Post-run Consistency Check
    const { count: assetCount, error: countError } = await supabase
      .from("test_question_assets")
      .select("*", { count: "exact", head: true })
      .eq("exam_id", examId);

    const isConsistent = !countError && assetCount === totalQuestions;
    if (!isConsistent) {
       console.warn(`Consistency mismatch: ${totalQuestions} questions vs ${assetCount} assets`);
    }

    // 7. Upload Manifest Generation
    const manifest = {
      job_id: jobId,
      exam_id: examId,
      generated_at: new Date().toISOString(),
      total_assets: totalQuestions,
      uploaded,
      failed,
      skipped,
      isConsistent
    };

    await supabase.storage.from(BUCKET_NAME).upload(
      `${job.institute_id}/${examId}/system-metadata/upload_manifest.json`,
      Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
      { upsert: true, contentType: "application/json" }
    );

    // 8. Determine final job status
    let finalStatus = "FAILED";
    if (uploaded === totalQuestions && isConsistent) {
      finalStatus = "COMPLETED";
    } else if (uploaded > 0) {
      finalStatus = "PARTIAL_SUCCESS";
    } else if (uploaded === 0 && skipped > 0 && failed === 0) {
      finalStatus = "COMPLETED"; // perfectly idempotent
    }

    // 9. Update Job
    await supabase
      .from("background_jobs")
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        attempts: job.attempts + 1,
        error: JSON.stringify(manifest)
      })
      .eq("id", jobId);

  } catch (error: any) {
    console.error("Worker failed fatally:", error);
    await supabase
      .from("background_jobs")
      .update({
        status: "FAILED",
        completed_at: new Date().toISOString(),
        attempts: job.attempts + 1,
        error: error.message || String(error)
      })
      .eq("id", jobId);
  }
}
