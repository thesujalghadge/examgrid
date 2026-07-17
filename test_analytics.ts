import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: jobs, error } = await supabase.from("analytics_jobs").select("status, error_text, created_at").order("created_at", { ascending: false }).limit(20);
  console.log("Recent jobs:", jobs);
}

main().catch(console.error);
