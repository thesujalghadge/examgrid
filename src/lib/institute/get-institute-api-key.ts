// Removed server-only for standalone script access

import { createClient } from "@supabase/supabase-js";
import { decryptApiKey } from "@/lib/crypto/api-key-encryption";

function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

import fs from "fs";
import path from "path";

const MOCK_KEYS_FILE = path.join(process.cwd(), ".mock-api-keys.json");

function getMockKey(instituteId: string) {
  try {
    if (fs.existsSync(MOCK_KEYS_FILE)) {
      const keys = JSON.parse(fs.readFileSync(MOCK_KEYS_FILE, "utf-8"));
      return keys[instituteId];
    }
  } catch {}
  return null;
}

export async function setInstituteGeminiKey(instituteId: string, encrypted: string, iv: string): Promise<boolean> {
  const supabase = createServiceRoleClient();
  if (!supabase) {
    // Fallback to local mock storage
    try {
      let keys: Record<string, { gemini_api_key_encrypted: string; gemini_api_key_iv: string }> = {};
      if (fs.existsSync(MOCK_KEYS_FILE)) {
        keys = JSON.parse(fs.readFileSync(MOCK_KEYS_FILE, "utf-8"));
      }
      keys[instituteId] = { gemini_api_key_encrypted: encrypted, gemini_api_key_iv: iv };
      fs.writeFileSync(MOCK_KEYS_FILE, JSON.stringify(keys, null, 2));
      return true;
    } catch {
      return false;
    }
  }

  const { error } = await supabase
    .from("institutes")
    .update({
      gemini_api_key_encrypted: encrypted,
      gemini_api_key_iv: iv,
      gemini_api_key_set_at: new Date().toISOString(),
    })
    .eq("id", instituteId);

  return !error;
}

export async function deleteInstituteGeminiKey(instituteId: string): Promise<boolean> {
  const supabase = createServiceRoleClient();
  if (!supabase) {
    try {
      if (fs.existsSync(MOCK_KEYS_FILE)) {
        const keys = JSON.parse(fs.readFileSync(MOCK_KEYS_FILE, "utf-8"));
        delete keys[instituteId];
        fs.writeFileSync(MOCK_KEYS_FILE, JSON.stringify(keys, null, 2));
      }
      return true;
    } catch {
      return false;
    }
  }

  const { error } = await supabase
    .from("institutes")
    .update({
      gemini_api_key_encrypted: null,
      gemini_api_key_iv: null,
      gemini_api_key_set_at: null,
    })
    .eq("id", instituteId);

  return !error;
}

export async function getInstituteGeminiKey(instituteId: string): Promise<string> {
  const supabase = createServiceRoleClient();
  let encrypted = null;
  let iv = null;

  if (supabase) {
    const { data, error } = await supabase
      .from("institutes")
      .select("gemini_api_key_encrypted, gemini_api_key_iv")
      .eq("id", instituteId)
      .single();
      
    if (!error && data) {
      encrypted = data.gemini_api_key_encrypted;
      iv = data.gemini_api_key_iv;
    }
  }

  if (!encrypted || !iv) {
    const mockData = getMockKey(instituteId);
    if (mockData?.gemini_api_key_encrypted && mockData?.gemini_api_key_iv) {
      encrypted = mockData.gemini_api_key_encrypted;
      iv = mockData.gemini_api_key_iv;
    }
  }

  if (!encrypted || !iv) {
    throw new Error(`No Gemini API key configured for institute ${instituteId}`);
  }

  return decryptApiKey(encrypted, iv);
}

export { createServiceRoleClient };
