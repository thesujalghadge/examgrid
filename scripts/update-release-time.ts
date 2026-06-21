import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function update() {
  const { data, error } = await supabase.from('exams').update({ solutions_release_time: new Date(Date.now() - 10000).toISOString() }).eq('legacy_id', 'E2E-TEST-1781797390290');
  console.log({ data, error });
}
update();
