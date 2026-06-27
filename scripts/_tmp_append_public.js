const fs = require('fs');
let content = fs.readFileSync('supabase/migrations/20260625095734_harden_rpc.sql', 'utf8');
content += '\nREVOKE EXECUTE ON FUNCTION public.submit_cbt_attempt(text, text, uuid, text, text, timestamptz, timestamptz, jsonb, jsonb, numeric, boolean) FROM PUBLIC;\n';
fs.writeFileSync('supabase/migrations/20260625095734_harden_rpc.sql', content);
console.log('Appended PUBLIC revoke');
