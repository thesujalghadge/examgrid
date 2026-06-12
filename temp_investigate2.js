require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function verifySignedAnswerKey(token, testId) {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    const signature = crypto.createHmac('sha256', secret).update(headerB64 + '.' + payloadB64).digest('base64url');
    if (signature !== signatureB64) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (payload.testId !== testId) return null;
    return payload.answerKey;
  } catch (e) {
    return null;
  }
}

async function run() {
  const { data: attempts, error } = await supabase
    .from('cbt_attempts')
    .select('id, test_id, signed_answer_key, result_breakdown')
    .order('submitted_at', { ascending: false })
    .limit(1);
    
  if (error || !attempts || attempts.length === 0) {
    console.error('Error fetching:', error);
    return;
  }
  
  const token = attempts[0].signed_answer_key;
  if (!token) {
    console.log("No signed answer key found");
    return;
  }
  
  const answerKey = verifySignedAnswerKey(token, attempts[0].test_id);
  console.log('ANSWER KEY:');
  console.log(JSON.stringify(answerKey, null, 2));
}
run();
