const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const baseUrl = 'http://localhost:3000';

async function testSubmitFlow() {
  const roll = 'CAM-JEE-26002';
  const instituteId = '00000000-0000-0000-0000-000000000001';
  const testId = '0bd2eec4-0d4c-4ab1-b5a2-8b0151b9910b';
  const sessionId = 'tsess_' + Date.now();

  console.log(`[1] Logging in as student ${roll}...`);
  const loginRes = await fetch(`${baseUrl}/api/workspace/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: roll, role: 'student', instituteId }),
  });
  
  if (!loginRes.ok) {
    console.error('Login failed:', await loginRes.text());
    return;
  }
  
  // Extract cookie
  const setCookieHeader = loginRes.headers.get('set-cookie');
  if (!setCookieHeader) {
     console.error('No cookie returned'); return;
  }
  const cookieMatch = setCookieHeader.match(/(eg_workspace_session=[^;]+)/);
  const cookie = cookieMatch ? cookieMatch[1] : '';

  console.log(`[2] Starting test session...`);
  const startRes = await fetch(`${baseUrl}/api/cbt/test-session/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({
      testId,
      durationMinutes: 180,
      sessionId,
      instituteId,
    }),
  });

  if (!startRes.ok) {
    console.error('Start failed:', await startRes.text());
    return;
  }

  const startData = await startRes.json();
  console.log('Start response:', startData);

  const startCookies = startRes.headers.getSetCookie();
  console.log('Start Cookies:', startCookies);
  const timerStr = startCookies.find(c => c.startsWith('eg_cbt_test_timer='));
  const timerCookieMatch = timerStr ? timerStr.match(/(eg_cbt_test_timer=[^;]+)/) : null;
  const timerCookie = timerCookieMatch ? timerCookieMatch[1] : '';
  const finalCookie = `${cookie}; ${timerCookie}`;

  console.log(`[3] Submitting test... Cookie:`, finalCookie);
  // Let's submit some fake answers
  const submitRes = await fetch(`${baseUrl}/api/cbt/test-session/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': finalCookie },
    body: JSON.stringify({
      testId,
      sessionId,
      instituteId,
      answers: { 'q1': 'A' },
      signedAnswerKey: startData.signedAnswerKey,
      integrityEvents: [],
      status: 'submitted',
      submittedAt: Date.now(),
    }),
  });

  if (!submitRes.ok) {
    console.error('Submit failed:', submitRes.status, await submitRes.text());
    return;
  }

  const submitData = await submitRes.json();
  console.log('Submit successful! Result:', submitData.score);

  console.log(`[4] Fetching result from server API...`);
  const resultRes = await fetch(`${baseUrl}/api/cbt/test-session/result?testId=${testId}`, {
     headers: { 'Cookie': finalCookie }
  });
  
  if (!resultRes.ok) {
    console.error('Result fetch failed:', resultRes.status, await resultRes.text());
    return;
  }
  
  const resultData = await resultRes.json();
  console.log('Result fetch successful! Data:', resultData);

  console.log(`[5] Querying database tables for proof...`);
  const { createClient } = require('@supabase/supabase-js');
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_ACCESS_TOKEN || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  
  const { count: attemptsCount } = await client.from('cbt_attempts').select('*', { count: 'exact', head: true });
  const { count: resultsCount } = await client.from('cbt_results').select('*', { count: 'exact', head: true });
  const { count: answersCount } = await client.from('cbt_attempt_answers').select('*', { count: 'exact', head: true });
  
  console.log(`\n=== DATABASE PROOF ===`);
  console.log(`cbt_attempts row count: ${attemptsCount}`);
  console.log(`cbt_results row count: ${resultsCount}`);
  console.log(`cbt_attempt_answers row count: ${answersCount}`);
  
  const { data: latestAttempt } = await client.from('cbt_attempts').select('id, student_roll_number, status, score').eq('session_id', sessionId).limit(1);
  console.log('Latest Attempt:', latestAttempt);
}

testSubmitFlow();
