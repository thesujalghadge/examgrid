import { beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

// Make supabase client available globally for tests to clean up
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const testSupabase = createClient(supabaseUrl, supabaseKey);

beforeAll(async () => {
  // Check that we are connected to a test database (safeguard)
  const { data: institute } = await testSupabase.from("institutes").select("id").limit(1);
  if (!institute) {
    throw new Error("Could not connect to test database. Ensure .env.test is correct.");
  }
});

afterAll(async () => {
  // Global cleanup if necessary
});
