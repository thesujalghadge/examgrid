const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.from('institutes').select('gemini_api_key').limit(1);
  if (data && data.length > 0) {
    console.log(data[0].gemini_api_key);
  } else {
    console.log("NO_KEY");
  }
}
main();
