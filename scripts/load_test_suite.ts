import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { parseArgs } from "util";
import { runAnalyticsWorker } from "../src/lib/analytics/worker";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const { values: args } = parseArgs({
  options: {
    mode: { type: "string", default: "rpc" },
    users: { type: "string", default: "100" },
    burst: { type: "boolean", default: true },
    window: { type: "string", default: "0" },
  },
  strict: false,
});

const MODE = args.mode as "rpc" | "api" | "full";
const USERS = parseInt(args.users as string, 10);
const BURST = args.burst;
const WINDOW_MS = parseInt(args.window as string, 10) * 1000;
const RUN_ID = Date.now().toString(36);

console.log("═══════════════════════════════════════════════");
console.log(`  EXAMGRID LOAD TEST SUITE`);
console.log(`  Mode: ${MODE.toUpperCase()} | Users: ${USERS} | Burst: ${BURST} | Window: ${args.window}s`);
console.log("═══════════════════════════════════════════════\n");

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculatePercentile(values: number[], percentile: number) {
  if (values.length === 0) return 0;
  values.sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * values.length) - 1;
  return values[index];
}

async function main() {
  console.log("[1] Setting up Mock Exam & Students...");
  
  const instId = crypto.randomUUID();
  const batchId = crypto.randomUUID();
  const examId = crypto.randomUUID();
  const sectionId = crypto.randomUUID();
  const q1Id = crypto.randomUUID();
  const subjectNodeId = crypto.randomUUID();
  const chapterNodeId = crypto.randomUUID();
  
  await adminDb.from("institutes").insert([{ id: instId, name: `Load Test Inst ${RUN_ID}`, slug: `lt-${RUN_ID}` }]).throwOnError();
  await adminDb.from("batches").insert({ id: batchId, institute_id: instId, name: "Load Batch", course_type: "JEE", academic_year: "2026", is_active: true }).throwOnError();
  await adminDb.from("exams").insert({
    id: examId, legacy_id: `lt-exam-${RUN_ID}`, institute_id: instId,
    title: "Load Test Exam", exam_type: "JEE_MAIN", duration_minutes: 180, scheduled_at: new Date().toISOString(), is_published: true
  }).throwOnError();
  await adminDb.from("exam_sections").insert({
    id: sectionId, exam_id: examId, institute_id: instId, name: "Physics", sort_order: 1
  }).throwOnError();
  await adminDb.from("exam_questions").insert([
    {
      id: q1Id, exam_id: examId, section_id: sectionId, institute_id: instId,
      question_number: 1, question_type: "MCQ_SINGLE", question_text: "Q1",
      correct_option_id: "A", marks: 4, negative_marks: 1, sort_order: 1
    }
  ]).throwOnError();
  await adminDb.from("batch_syllabus_nodes").insert([
    { id: subjectNodeId, institute_id: instId, batch_id: batchId, node_type: "SUBJECT", name: "Physics", parent_id: null },
    { id: chapterNodeId, institute_id: instId, batch_id: batchId, node_type: "CHAPTER", name: "Mechanics", parent_id: subjectNodeId }
  ]).throwOnError();
  await adminDb.from("question_syllabus_mappings").insert([
    {
      question_id: q1Id, institute_id: instId, batch_id: batchId, 
      syllabus_subject_id: subjectNodeId, syllabus_chapter_id: chapterNodeId,
      mapping_method: "MANUAL_CORRECTION"
    }
  ]).throwOnError();

  const students = Array.from({ length: USERS }).map((_, i) => ({
    id: crypto.randomUUID(),
    institute_id: instId,
    batch_id: batchId,
    roll_number: `lt-${RUN_ID}-${i}`,
    name: `Test Student ${i}`,
    full_name: `Test Student ${i}`,
    application_number: `APP-${RUN_ID}-${i}`
  }));

  // Bulk insert students in chunks of 500
  for (let i = 0; i < students.length; i += 500) {
    const chunk = students.slice(i, i + 500);
    const { error } = await adminDb.from("students").insert(chunk);
    if (error) {
      console.error("Failed to insert students:", error);
      process.exit(1);
    }
  }

  const payloads = students.map((s, i) => ({
    p_session_id: `sess-${RUN_ID}-${i}`,
    p_test_id: examId,
    p_institute_id: instId,
    p_student_roll_number: s.roll_number,
    p_status: "submitted",
    p_started_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    p_submitted_at: new Date().toISOString(),
    p_answers: { [q1Id]: "A" }, 
    p_result_breakdown: {
      perQuestion: [{ questionId: q1Id, selected: "A", correct: true, marksAwarded: 4 }],
      durationSeconds: 3600,
      attempted: 1, correct: 1, incorrect: 0, unattempted: 0,
      finalScore: 4, maxScore: 4
    }, 
    p_integrity_score: 100, 
    p_flagged: false
  }));

  console.log(`[2] Triggering ${USERS} Concurrent Submissions...`);
  
  const startTime = Date.now();
  let errors = 0;
  const latencies: number[] = [];
  const startTimes = new Map<string, number>();

  const tasks = payloads.map(async (payload, i) => {
    // Stagger if not bursting instantly
    if (!BURST && WINDOW_MS > 0) {
      const delay = Math.random() * WINDOW_MS;
      await sleep(delay);
    }
    
    const reqStart = Date.now();
    startTimes.set(payload.p_session_id, reqStart);
    
    if (MODE === "api") {
      // Stub for API mode, since cookies/signatures are needed, we mock HTTP overhead.
      // In a real environment we'd construct the full HTTP request.
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/submit_cbt_attempt`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_SERVICE_KEY,
          "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }).then(res => {
        if (!res.ok) errors++;
      }).catch(() => errors++);
    } else {
      // rpc or full
      const { error } = await adminDb.rpc("submit_cbt_attempt", payload);
      if (error) {
        errors++;
      }
    }
    
    latencies.push(Date.now() - reqStart);
  });

  await Promise.all(tasks);
  const endTime = Date.now();
  const totalDurationSeconds = (endTime - startTime) / 1000;
  const tps = USERS / totalDurationSeconds;

  console.log("\n  📊 Submission API Metrics:");
  console.log(`     P50 Latency:  ${calculatePercentile(latencies, 50)}ms`);
  console.log(`     P95 Latency:  ${calculatePercentile(latencies, 95)}ms`);
  console.log(`     P99 Latency:  ${calculatePercentile(latencies, 99)}ms`);
  console.log(`     Throughput:   ${tps.toFixed(2)} TPS`);
  console.log(`     Error Rate:   ${((errors / USERS) * 100).toFixed(2)}%`);

  if (MODE === "full") {
    console.log("\n[3] Waiting for Analytics Worker to process backlog...");
    
    // Fetch attempt IDs to map back to students
    const { data: attempts } = await adminDb.from("cbt_attempts").select("id, session_id").eq("test_id", examId);
    
    // In ExamGrid, the Next.js API normally enqueues analytics_jobs.
    // Since we called the RPC directly, we must enqueue them manually to simulate the API.
    if (attempts && attempts.length > 0) {
      const studentMap = new Map(students.map(s => [s.roll_number, s.id]));
      const jobsToInsert = attempts.map(a => {
        const studentIndex = payloads.findIndex(p => p.p_session_id === a.session_id);
        const studentId = studentMap.get(payloads[studentIndex].p_student_roll_number);
        return {
          attempt_id: a.id,
          student_id: studentId,
          exam_id: examId,
          batch_id: batchId,
          status: "PENDING"
        };
      });
      await adminDb.from("analytics_jobs").insert(jobsToInsert);
    }
    
    const attemptToSession = new Map(attempts?.map(a => [a.id, a.session_id]));
    
    let completed = 0;
    let failed = 0;
    let pending = USERS;
    let peakQueue = 0;
    
    const ttaTimes: number[] = [];

    const workerStartTime = Date.now();
    let workerActive = true;
    
    while (completed + failed < USERS && workerActive) {
      // Trigger a worker loop iteration synchronously
      try {
        await runAnalyticsWorker();
      } catch(e) {
        console.error("Worker crashed:", e);
        workerActive = false;
      }
      
      await sleep(2000);
      const { data: jobs } = await adminDb.from("analytics_jobs")
        .select("status, attempt_id, completed_at")
        .eq("exam_id", examId);
        
      if (!jobs) continue;
      
      completed = jobs.filter(j => j.status === "COMPLETED").length;
      failed = jobs.filter(j => j.status === "FAILED").length;
      pending = jobs.filter(j => j.status === "PENDING" || j.status === "PROCESSING").length;
      if (pending > peakQueue) peakQueue = pending;
      
      process.stdout.write(`\r     Queue: ${pending} pending | ${completed} completed | ${failed} failed `);
      
      // Calculate TTA for completed jobs
      jobs.filter(j => j.status === "COMPLETED" && j.completed_at).forEach(j => {
        const sess = attemptToSession.get(j.attempt_id);
        if (sess && startTimes.has(sess)) {
          const tta = new Date(j.completed_at!).getTime() - startTimes.get(sess)!;
          ttaTimes.push(tta);
          startTimes.delete(sess); // don't count twice
        }
      });
    }
    
    const workerDuration = (Date.now() - workerStartTime) / 1000;
    const analyticsRowsGenerated = USERS * 1; // currently 1 question per attempt
    const rowsPerSec = analyticsRowsGenerated / workerDuration;
    
    console.log("\n\n  📊 Analytics Engine Metrics:");
    console.log(`     P50 Time-To-Analytics: ${calculatePercentile(ttaTimes, 50) / 1000}s`);
    console.log(`     P95 Time-To-Analytics: ${calculatePercentile(ttaTimes, 95) / 1000}s`);
    console.log(`     P99 Time-To-Analytics: ${calculatePercentile(ttaTimes, 99) / 1000}s`);
    console.log(`     Total Queue Clear:     ${workerDuration.toFixed(1)}s`);
    console.log(`     Peak Queue Depth:      ${peakQueue}`);
    console.log(`     Analytics Rows/Sec:    ${rowsPerSec.toFixed(2)} rows/sec`);
    console.log(`     Failure Rate:          ${((failed / USERS) * 100).toFixed(2)}%`);
    
    // Data Integrity Validation
    const { data: finalAttempts } = await adminDb.from("cbt_attempts").select("id").eq("test_id", examId);
    if (finalAttempts?.length !== USERS) {
      console.error(`\n  ❌ DATA LOSS DETECTED: Expected ${USERS} attempts, found ${finalAttempts?.length || 0}`);
    } else {
      console.log(`\n  ✅ DATA INTEGRITY: ${USERS} attempts stored successfully.`);
    }
    
    const { data: finalAnalytics } = await adminDb.from("question_analytics").select("attempt_count").eq("exam_id", examId).eq("question_id", q1Id).single();
    if (finalAnalytics?.attempt_count !== USERS) {
      console.error(`  ❌ DATA LOSS DETECTED: Expected ${USERS} question analytics entries, found ${finalAnalytics?.attempt_count || 0}`);
    } else {
      console.log(`  ✅ DATA INTEGRITY: ${USERS} question analytics rows properly aggregated.`);
    }
  }

  console.log("\n[4] Cleaning up Mock Data...");
  await adminDb.from("analytics_jobs").delete().eq("exam_id", examId);
  await adminDb.from("cbt_results").delete().eq("test_id", examId);
  await adminDb.from("cbt_attempts").delete().eq("test_id", examId);
  
  await adminDb.from("question_syllabus_mappings").delete().eq("question_id", q1Id);
  await adminDb.from("exam_questions").delete().eq("id", q1Id);
  await adminDb.from("exam_sections").delete().eq("id", sectionId);
  await adminDb.from("batch_syllabus_nodes").delete().in("id", [subjectNodeId, chapterNodeId]);
  
  await adminDb.from("exams").delete().eq("id", examId);
  await adminDb.from("students").delete().eq("institute_id", instId);
  await adminDb.from("batches").delete().eq("institute_id", instId);
  await adminDb.from("institutes").delete().eq("id", instId);

  console.log("═══════════════════════════════════════════════");
  console.log("  Load Test Complete");
  console.log("═══════════════════════════════════════════════");
}

main().catch(console.error);
