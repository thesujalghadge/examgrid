const fs = require('fs');
const rpc = fs.readFileSync('scripts/update_rpc.sql', 'utf8');
let content = '-- Harden submit_cbt_attempt RPC and revoke public access (CBT-2026-001)\n\n';
content += rpc;
content += '\n\nREVOKE EXECUTE ON FUNCTION public.submit_cbt_attempt(text, text, uuid, text, text, timestamptz, timestamptz, jsonb, jsonb, numeric, boolean) FROM anon;';
content += '\nREVOKE EXECUTE ON FUNCTION public.submit_cbt_attempt(text, text, uuid, text, text, timestamptz, timestamptz, jsonb, jsonb, numeric, boolean) FROM authenticated;\n';

fs.writeFileSync('supabase/migrations/20260625095734_harden_rpc.sql', content);
console.log('Migration written');
