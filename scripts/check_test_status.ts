import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: tests } = await supabase.from('cbt_tests').select('*').order('created_at', { ascending: false }).limit(1);
  console.log("Latest Test:", JSON.stringify(tests, null, 2));
  
  if (tests && tests.length > 0) {
     const testId = tests[0].id;
     const { count } = await supabase.from('cbt_questions').select('*', { count: 'exact' }).eq('test_id', testId);
     console.log("Questions extracted:", count);
  }
}
main();
