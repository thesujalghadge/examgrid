import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const now = new Date();
  console.log("Setting schedule start to:", now.toISOString());
  const end = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const { error } = await supabase.from('exam_schedules').update({ start_at: now.toISOString(), end_at: end.toISOString() }).neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) console.error(error);
  else console.log("Schedule updated!");
}
main();
