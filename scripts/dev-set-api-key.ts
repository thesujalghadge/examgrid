import { encryptApiKey } from '../src/lib/crypto/api-key-encryption';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { encrypted, iv } = await encryptApiKey(process.env.GEMINI_API_KEY || 'AIzaSyA...');
  const res = await supabase.from('institutes').update({gemini_api_key_encrypted: encrypted, gemini_api_key_iv: iv}).eq('id', '11111111-1111-1111-1111-111111111111');
  console.log('Set API key: ', res.error ? res.error : 'Success');
}

main();
