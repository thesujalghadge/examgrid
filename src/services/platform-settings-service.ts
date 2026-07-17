"use server";

import { createServiceRoleClient } from "@/lib/institute/get-institute-api-key";
import { encryptApiKey, decryptApiKey } from "@/lib/crypto/api-key-encryption";

const getClient = () => {
  const client = createServiceRoleClient();
  if (!client) throw new Error("Supabase service role is not configured");
  return client;
};

export async function getPlatformSetting(keyName: string) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("platform_settings")
    .select("key_value")
    .eq("key_name", keyName)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message);
  }
  
  if (!data?.key_value) return null;

  try {
    if (keyName === "GEMINI_API_KEY") {
      const parsed = JSON.parse(data.key_value);
      if (parsed.encrypted && parsed.iv) {
        return await decryptApiKey(parsed.encrypted, parsed.iv);
      }
    }
    return data.key_value;
  } catch (e) {
    console.error("Failed to parse or decrypt setting:", e);
    // If it fails to parse as JSON, maybe it was saved plaintext previously, so fallback
    return data.key_value; 
  }
}

export async function setPlatformSetting(keyName: string, keyValue: string) {
  const supabase = getClient();
  
  let finalValue = keyValue;

  if (keyName === "GEMINI_API_KEY" && keyValue.trim() !== "") {
    const encryptedData = await encryptApiKey(keyValue);
    finalValue = JSON.stringify(encryptedData);
  }

  // Upsert the setting
  const { error } = await supabase
    .from("platform_settings")
    .upsert({ 
      key_name: keyName, 
      key_value: finalValue,
      updated_at: new Date().toISOString()
    }, { onConflict: 'key_name' });

  if (error) {
    throw new Error(error.message);
  }
}
