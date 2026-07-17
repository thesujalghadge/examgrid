import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("Running worker...");
  const { runAnalyticsWorker } = require("./src/lib/analytics/worker");
  await runAnalyticsWorker();

  const attemptId = '5680c6c5-e994-4604-aad8-b7ee46a45825';
  
  const { data: job } = await supabase.from("analytics_jobs").select("status, error_text").eq("attempt_id", attemptId).maybeSingle();
  console.log("Job status:", job);
}

main().catch(console.error);
