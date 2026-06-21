import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkQueueCounts() {
  const { data, error } = await supabase
    .from("solution_generation_queue")
    .select("status");

  if (error) {
    console.error("Error fetching queue:", error);
    return;
  }

  const counts: Record<string, number> = {
    PENDING: 0,
    PROCESSING: 0,
    WAITING_RETRY: 0,
    FAILED: 0,
    COMPLETED: 0
  };

  for (const item of data || []) {
    if (counts[item.status] !== undefined) {
      counts[item.status]++;
    } else {
      counts[item.status] = 1;
    }
  }

  console.log("=== QUEUE OBSERVABILITY REPORT ===");
  console.log(`PENDING: ${counts.PENDING}`);
  console.log(`PROCESSING: ${counts.PROCESSING}`);
  console.log(`WAITING_RETRY: ${counts.WAITING_RETRY}`);
  console.log(`FAILED: ${counts.FAILED}`);
  console.log(`COMPLETED: ${counts.COMPLETED}`);
  console.log("==================================");
  
  // Show a couple of failed items for diagnostics
  const { data: failedItems } = await supabase
    .from("solution_generation_queue")
    .select("failure_stage, failure_reason, last_error, attempts")
    .in("status", ["FAILED", "WAITING_RETRY"])
    .limit(3);
    
  if (failedItems && failedItems.length > 0) {
     console.log("\nSample Failed/Retry Diagnostics:");
     console.table(failedItems);
  }
}

checkQueueCounts();
