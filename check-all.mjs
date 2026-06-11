import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_ACCESS_TOKEN || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data: attempts } = await client.from("cbt_attempts").select("session_id, student_roll_number, test_id, answers");
  console.log("ALL ATTEMPTS:");
  console.log(JSON.stringify(attempts, null, 2));

  const { data: attemptAnswers } = await client.from("cbt_attempt_answers").select("*").limit(5);
  console.log("FIRST 5 ATTEMPT ANSWERS:");
  console.log(JSON.stringify(attemptAnswers, null, 2));
}

check();
