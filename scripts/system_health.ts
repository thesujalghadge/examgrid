import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from("solution_generation_queue")
    .select("status");

  if (error) {
    console.error("Failed to fetch queue status:", error.message);
    process.exit(1);
  }

  const counts: Record<string, number> = {
    PENDING: 0,
    PROCESSING: 0,
    WAITING_RETRY: 0,
    COMPLETED: 0,
    FAILED: 0,
    TIMED_OUT: 0,
  };

  data.forEach((row) => {
    if (counts[row.status] !== undefined) {
      counts[row.status]++;
    } else {
      counts[row.status] = 1;
    }
  });

  console.log(`
Pending: ${counts.PENDING}
Processing: ${counts.PROCESSING}
Waiting Retry: ${counts.WAITING_RETRY}
Completed: ${counts.COMPLETED}
Failed: ${counts.FAILED}
`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
