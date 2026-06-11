import { NextResponse } from 'next/server';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { getInstituteGeminiKey } from "@/lib/institute/get-institute-api-key";
import { readVerifiedWorkspaceSession } from "@/lib/workspace-session-server";

export async function POST(
  request: Request,
  context: { params: Promise<{ instituteId: string }> }
) {
  try {
    const { instituteId } = await context.params;
    const session = await readVerifiedWorkspaceSession();
    if (!session || (session.role !== "platform_admin" && (session.role !== "institute" || session.instituteId !== instituteId))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const pdfFile = formData.get('file') as File;

    if (!pdfFile) {
      return NextResponse.json({ error: 'No PDF file provided.' }, { status: 400 });
    }

    // Convert file to buffer to hash
    const arrayBuffer = await pdfFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Hash the PDF to generate a unique, deterministic Job ID
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const pipelineVersion = 'v4'; // Increment to invalidate cache when pipeline logic changes
    const jobId = `vision_job_${hash.substring(0, 16)}_${pipelineVersion}`;

    const cbtAssetsDir = path.join(process.cwd(), 'public', 'uploads', 'cbt_assets', jobId);
    const cropsMetaPath = path.join(cbtAssetsDir, 'crops_meta.json');

    // CACHE CHECK: If crops_meta.json exists, we skip the pipeline entirely
    if (fs.existsSync(cropsMetaPath)) {
      console.log(`[Cache Hit] Serving pre-extracted crops meta JSON for job: ${jobId}`);
      const cropsData = JSON.parse(fs.readFileSync(cropsMetaPath, 'utf8'));
      return NextResponse.json(cropsData, { status: 200 });
    }

    console.log(`[Cache Miss] Starting Vision-First pipeline for job: ${jobId}`);
    
    // Save the PDF locally for Python to process
    fs.mkdirSync(cbtAssetsDir, { recursive: true });
    const localPdfPath = path.join(cbtAssetsDir, 'paper.pdf');
    fs.writeFileSync(localPdfPath, buffer);

    // Fetch Institute API Key (Optional for deterministic pipeline)
    let apiKey = "mock_key";
    try {
      apiKey = await getInstituteGeminiKey(instituteId) || "mock_key";
    } catch {
      console.warn('Institute Gemini API Key not configured. Using mock_key for deterministic pipeline.');
    }

    const orchestratorPath = path.join(process.cwd(), 'scripts', 'pipeline', 'vision_orchestrator.py');

    return new Promise<Response>((resolve) => {
      const pyProcess = spawn('python', [orchestratorPath, localPdfPath, jobId, apiKey], {
        cwd: process.cwd(),
      });

      pyProcess.on('error', (err) => {
        console.error("[VisionPipeline ERR] Process error:", err);
      });

      request.signal.addEventListener('abort', () => {
        try {
          if (!pyProcess.killed) pyProcess.kill();
        } catch (e) {
          console.error("Failed to kill python process on abort:", e);
        }
      });

      let stdoutData = '';
      let stderrData = '';

      pyProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
        process.stdout.write(`[VisionPipeline] ${data.toString()}`);
      });

      pyProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
        process.stderr.write(`[VisionPipeline ERR] ${data.toString()}`);
      });

      pyProcess.on('close', (code) => {
        if (code !== 0) {
          console.error(`Pipeline exited with code ${code}`);
          return resolve(
            NextResponse.json({ error: 'Vision Pipeline Failed', details: stderrData }, { status: 500 })
          );
        }

        // Wait for crops_meta.json to be written
        if (fs.existsSync(cropsMetaPath)) {
          const cropsData = JSON.parse(fs.readFileSync(cropsMetaPath, 'utf8'));
          return resolve(NextResponse.json(cropsData, { status: 200 }));
        } else {
          return resolve(
            NextResponse.json({ error: 'Pipeline succeeded but crops_meta.json not found' }, { status: 500 })
          );
        }
      });
    });

  } catch (error) {
    console.error('Error in parse-paper-v2:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
