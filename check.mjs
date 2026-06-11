import { createClient } from "@supabase/supabase-js";

const url = "https://nuehkzaogrybhizgnchz.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51ZWhremFvZ3J5YmhpemduY2h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NDY1MDUsImV4cCI6MjA5NDUyMjUwNX0.aE-rMLszbmvOgYfj0nfUVHUuVjnTH9fqycSa_S0Xd0o";

const client = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function run() {
  const { data, error } = await client.from("cbt_attempt_answers").select("*").limit(15);
  if (error) {
    console.log(`Error: ${error.message}`);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}
run();
