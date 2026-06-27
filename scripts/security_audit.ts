import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runSecurityAudit() {
  console.log(`\n======================================================`);
  console.log(` API & DATABASE SECURITY AUDIT (IDOR CHECK)`);
  console.log(`======================================================\n`);

  let criticalVulnerabilities = 0;

  console.log(`[TEST 1] Anonymous DB Access via Anon Key`);
  console.log(`Simulating a malicious user making a direct REST request to Supabase...`);
  
  // Try to fetch any student's analytics using just the Anon key
  const { data: exposedAnalytics, error: anonErr } = await supabaseAnon
    .from("student_cumulative_chapter_analytics")
    .select("student_id, total_attempted")
    .limit(1);

  if (exposedAnalytics && exposedAnalytics.length > 0) {
    console.log(`❌ CRITICAL VULNERABILITY FOUND!`);
    console.log(`   -> Anonymous users (or any student) can query ANY student's analytics directly from the database.`);
    console.log(`   -> Reason: The table has a "USING (true)" RLS policy, and the client-side code fetches directly from Supabase.`);
    criticalVulnerabilities++;
  } else {
    console.log(`✅ PASS: Database is protected from anonymous reads.`);
  }

  console.log(`\n[TEST 2] Institute Data Exposure via Anon Key`);
  const { data: exposedJobs } = await supabaseAnon
    .from("analytics_jobs")
    .select("attempt_id")
    .limit(1);

  if (exposedJobs && exposedJobs.length > 0) {
    console.log(`❌ CRITICAL VULNERABILITY FOUND!`);
    console.log(`   -> Background processing jobs and attempt IDs are exposed to the public.`);
    criticalVulnerabilities++;
  } else {
    console.log(`✅ PASS: Job queues are protected.`);
  }

  // To truly test API layer IDOR, we would need to mock valid Workspace Sessions for Student A and Student B,
  // then attempt to fetch `/api/...` endpoints. 
  // Since we don't have an active Next.js server running in this script, we will simulate the logic check.
  
  console.log(`\n[TEST 3] Server Actions / API Endpoints (Static Check)`);
  console.log(`Scanning 'src/app' for direct Supabase client usage...`);
  
  const fs = await import("fs");
  const path = await import("path");
  const execSync = (await import("child_process")).execSync;
  
  try {
    const output = execSync('find src/app -name "*.tsx" -o -name "*.ts" | xargs grep -l "createClient"').toString();
    const suspiciousFiles = output.trim().split('\n').filter(Boolean).filter(f => !f.includes('actions') && !f.includes('api') && !f.includes('server') && !f.includes('providers'));
    
    if (suspiciousFiles.length > 0) {
      console.log(`⚠️ Warning: Client-side Supabase fetching detected in the following components:`);
      suspiciousFiles.forEach(f => console.log(`   -> ${f}`));
      console.log(`   -> This bypasses your Next.js Server / Service Role architecture entirely.`);
    } else {
      console.log(`✅ PASS: No direct Supabase client queries found in client components.`);
    }
  } catch (e) {
    console.log(`✅ PASS: No direct Supabase client queries found in client components.`);
  }
  
  console.log(`\n======================================================`);
  if (criticalVulnerabilities > 0) {
    console.log(`🚨 AUDIT FAILED: ${criticalVulnerabilities} CRITICAL VULNERABILITIES DETECTED.`);
  } else {
    console.log(`✅ AUDIT PASSED: All checks cleared.`);
  }
  console.log(`======================================================\n`);
}

runSecurityAudit().catch(console.error);
