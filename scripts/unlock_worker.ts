import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("🔓 Unlocking global worker state...");
  
  const { data, error } = await supabase
    .from("global_worker_state")
    .update({
      is_running: false,
      worker_id: null,
      locked_at: null,
      expires_at: null
    })
    .eq("id", 1)
    .select();

  if (error) {
    console.error("❌ Failed to unlock worker:");
    console.error(error.message);
    
    if (error.message.includes("does not exist")) {
      console.error("\nHint: The 'global_worker_state' table is missing. You need to run the missing_production_migrations.sql script in your Supabase Editor first.");
    }
    process.exit(1);
  }

  console.log("✅ Worker successfully unlocked. Queue processing can now resume.");
  console.log("Current state:", data);
}

main().catch(console.error);
