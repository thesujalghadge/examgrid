import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function run() {
  const { data: e } = await s
    .from("exams")
    .select("institute_id")
    .eq("id", "acfb81f5-5a41-456a-a92b-11692b9074ee")
    .single();

  console.log("Institute ID: " + e?.institute_id);

  if (e?.institute_id) {
    const mockKey = {
      gemini_api_key_encrypted:
        "pUSMdwinv5DmZ6IOrDqyQfJvaK4VrEWJJstHczb2vUky6QdCTXHFor9WEeldX0NmKA46pNZ1Yw==",
      gemini_api_key_iv: "037afec91c6827013df83c92e765ecbb",
    };
    await s.from("institutes").update(mockKey).eq("id", e.institute_id);
    console.log("Updated db mock key for institute.");
  }
}

run();
