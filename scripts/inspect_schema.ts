import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const url = `${supabaseUrl}/rest/v1/?apikey=${supabaseKey}`;
  const res = await fetch(url);
  const data = await res.json();
  
  const def = data.definitions?.solution_generation_queue?.properties;
  if (def) {
    console.log("Columns in solution_generation_queue:");
    console.log(Object.keys(def).join('\n'));
  } else {
    console.log("Could not find table definition in openapi schema.");
  }
}

main().catch(console.error);
