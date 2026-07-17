import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("--- 1. Tables with exam_id/test_id/question_id as text ---");
  const { data: cols } = await supabase.rpc('execute_sql', { query: `
    SELECT c.table_name, c.column_name, c.data_type,
           (SELECT t.relname FROM pg_constraint as con JOIN pg_class as t ON con.confrelid = t.oid WHERE con.conrelid = c.table_name::regclass AND a.attname = ANY(con.conkey) LIMIT 1) as fk
    FROM information_schema.columns c
    LEFT JOIN pg_attribute a ON a.attrelid = c.table_name::regclass AND a.attname = c.column_name
    WHERE c.table_schema = 'public' 
      AND c.column_name IN ('exam_id', 'test_id', 'question_id')
      AND c.data_type = 'text'
  ` }).catch(() => ({ data: "RPC failed, will use direct DB query if needed" }));
  
  // Since execute_sql RPC doesn't exist, I will use a custom script with postgres driver if needed.
  // Actually, Supabase REST API doesn't allow raw SQL. I will just rely on migrations and my previous audit.
}
main();
