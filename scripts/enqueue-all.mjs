import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function enqueueMissingSolutions() {
  const realInstituteId = "babb0669-a6ec-454f-923a-440f0144f68f";

  const { error: resetError } = await supabase
    .from("solution_generation_queue")
    .update({ status: "PENDING", attempts: 0, institute_id: realInstituteId })
    .neq("status", "PENDING");

  if (resetError) {
    console.error("Failed to reset jobs:", resetError);
  } else {
    console.log("Reset FAILED jobs to PENDING with correct institute ID");
  }

  // Hit the local processing endpoint to kickstart the worker
  try {
    const res = await fetch("http://localhost:3000/api/internal/process-solution-queue", {
      method: "POST",
      headers: { "authorization": `Bearer ${process.env.CRON_SECRET || 'dev-secret'}` }
    });
    const body = await res.text();
    console.log("Triggered worker:", res.status, body);
  } catch (err) {
    console.log("Failed to trigger worker. Is local server running?", err.message);
  }
}

enqueueMissingSolutions().catch(console.error);
