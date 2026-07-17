import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: exams } = await supabase.from('exams').select('id, legacy_id');
  if (exams) {
    for (const exam of exams) {
      if (exam.legacy_id) {
        const { error } = await supabase
          .from('exam_schedules')
          .update({ exam_id: exam.id })
          .eq('exam_id', exam.legacy_id);
        if (!error) console.log('Fixed schedule for:', exam.legacy_id);
      }
    }
  }
}
main();
