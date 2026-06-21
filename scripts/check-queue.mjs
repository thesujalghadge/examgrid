import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkStatus() {
  const { data: queue } = await supabase.from("solution_generation_queue").select("status, question_id").limit(10);
  const { count: queuePending } = await supabase.from("solution_generation_queue").select("*", { head: true, count: "exact" }).eq("status", "pending");
  const { count: queueCompleted } = await supabase.from("solution_generation_queue").select("*", { head: true, count: "exact" }).eq("status", "completed");
  const { count: queueFailed } = await supabase.from("solution_generation_queue").select("*", { head: true, count: "exact" }).eq("status", "failed");

  const { data: solutions } = await supabase.from("question_solutions").select("question_id").limit(10);

  console.log("Queue Pending:", queuePending);
  console.log("Queue Completed:", queueCompleted);
  console.log("Queue Failed:", queueFailed);
  console.log("Solutions in DB:", solutions?.length || 0);
  console.log("Queue sample:", queue);
}

checkStatus().catch(console.error);
