import { loadEnvFiles, getProjectRef } from "./scripts/supabase/load-env.mjs";

loadEnvFiles();
const projectRef = getProjectRef();
const token = process.env.SUPABASE_ACCESS_TOKEN;

const sql = `
  GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
  GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;
`;

fetch('https://api.supabase.com/v1/projects/' + projectRef + '/database/query', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({query: sql})
}).then(async r => {
  console.log(r.status);
  console.log(await r.text());
});
