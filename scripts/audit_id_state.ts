import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const TABLES = [
  "exam_schedules",
  "cbt_attempts",
  "analytics_jobs",
  "analytics_snapshots",
  "student_recommendations",
  "question_analytics",
  "student_exam_subject_analytics",
  "student_exam_chapter_analytics",
  "student_exam_concept_analytics",
  "exam_solution_status"
];

async function main() {
  const results = [];
  
  for (const table of TABLES) {
    const idCol = table === "cbt_attempts" ? "test_id" : "exam_id";
    
    // Check if table exists (or skip gracefully if it errors)
    const { data: rows, error } = await supabase.from(table).select(idCol);
    if (error) {
      console.log(`Skipping ${table}: ${error.message}`);
      continue;
    }
    
    let rowCount = rows.length;
    let uuidCount = 0;
    let legacyCount = 0;
    let orphanCount = 0;
    
    for (const row of rows) {
      const val = row[idCol];
      if (!val) continue;
      
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
      if (isUuid) {
        uuidCount++;
      } else {
        legacyCount++;
      }
      
      // Check orphan (not in exams table)
      // For legacy, check if legacy_id exists. For uuid, check if id exists.
      let q = supabase.from("exams").select("id").limit(1);
      if (isUuid) {
         q = q.eq("id", val);
      } else {
         q = q.eq("legacy_id", val);
      }
      const { data: match } = await q;
      if (!match || match.length === 0) {
        orphanCount++;
      }
    }
    
    results.push({
      table,
      idCol,
      rowCount,
      legacyCount,
      uuidCount,
      orphanCount,
    });
  }
  
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
