const fs = require('fs');
let content = fs.readFileSync('supabase/missing_production_migrations.sql', 'utf8');
const rpc = fs.readFileSync('scripts/update_rpc.sql', 'utf8');

content += '\n\n-- 7. Harden submit_cbt_attempt RPC and revoke public access (CBT-2026-001)\n';
content += rpc;
content += '\n\nREVOKE EXECUTE ON FUNCTION public.submit_cbt_attempt(text, text, uuid, text, text, timestamptz, timestamptz, jsonb, jsonb, numeric, boolean) FROM anon;';
content += '\nREVOKE EXECUTE ON FUNCTION public.submit_cbt_attempt(text, text, uuid, text, text, timestamptz, timestamptz, jsonb, jsonb, numeric, boolean) FROM authenticated;\n';

fs.writeFileSync('supabase/missing_production_migrations.sql', content);
console.log('Appended to missing_production_migrations.sql');
