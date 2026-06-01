import "server-only";

import { createClient } from "@supabase/supabase-js";
import { decryptApiKey } from "@/lib/crypto/api-key-encryption";

function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service role credentials are not configured");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function getInstituteGeminiKey(instituteId: string): Promise<string> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("institutes")
    .select("gemini_api_key_encrypted, gemini_api_key_iv")
    .eq("id", instituteId)
    .single();

  if (error || !data?.gemini_api_key_encrypted || !data.gemini_api_key_iv) {
    throw new Error(`No Gemini API key configured for institute ${instituteId}`);
  }

  return decryptApiKey(data.gemini_api_key_encrypted, data.gemini_api_key_iv);
}

export { createServiceRoleClient };
