import fs from "fs";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const baseUrl = "http://localhost:3000";

async function testSubmitFlow() {
  const roll = "CAM-JEE-26002";
  const instituteId = "00000000-0000-0000-0000-000000000001";
  const testId = "0bd2eec4-0d4c-4ab1-b5a2-8b0151b9910b";
  const sessionId = "tsess_" + Date.now();

  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  
  // DELETE existing attempt so we test the insert path!
  console.log(`[0] Deleting existing attempts...`);
  await client.from("cbt_attempts").delete().eq("student_roll_number", roll).eq("test_id", testId);

  console.log(`[1] Logging in...`);
  const loginRes = await fetch(`${baseUrl}/api/workspace/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: roll, role: "student", instituteId }),
  });
  
  const cookieMatch = loginRes.headers.get("set-cookie")?.match(/(eg_workspace_session=[^;]+)/);
  const cookie = cookieMatch ? cookieMatch[1] : "";

  console.log(`[2] Starting session...`);
  const startRes = await fetch(`${baseUrl}/api/cbt/test-session/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cookie": cookie },
    body: JSON.stringify({ testId, durationMinutes: 180, sessionId, instituteId }),
  });
  
  const startData = await startRes.json();
  let timerCookie = "";
  const setCookies = startRes.headers.getSetCookie ? startRes.headers.getSetCookie() : [];
  if (setCookies.length) {
    const timerStr = setCookies.find(c => c.startsWith('eg_cbt_test_timer='));
    timerCookie = timerStr ? timerStr.match(/(eg_cbt_test_timer=[^;]+)/)[1] : "";
  }
  const finalCookie = `${cookie}; ${timerCookie}`;

  // Use the signedAnswerKey directly instead of trying to decode it
  // But wait, we need a valid question ID. We can extract it from the JWT.
  const jwtParts = startData.signedAnswerKey.split(".");
  // The payload is the second part
  let parsedAnswerKey;
  try {
      const payloadBase64 = jwtParts[0].replace(/-/g, '+').replace(/_/g, '/');
      const payloadDecoded = Buffer.from(payloadBase64, 'base64').toString('utf8');
      parsedAnswerKey = JSON.parse(payloadDecoded);
  } catch (e) {
      console.log("Could not decode JWT payload", e);
      return;
  }
  
  const answerKeyMap = parsedAnswerKey.answerKey;
  const questionIds = Object.keys(answerKeyMap);
  
  if (questionIds.length === 0) {
    console.error("No questions found in answer key!");
    return;
  }
  
  const q1 = questionIds[0];
  const optA = answerKeyMap[q1].correctOptionId || q1 + "-opt-A";
  
  console.log(`[3] Submitting answer for question ${q1}: ${optA}`);
  const submitRes = await fetch(`${baseUrl}/api/cbt/test-session/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cookie": finalCookie },
    body: JSON.stringify({
      testId,
      sessionId,
      instituteId,
      answers: { [q1]: optA },
      signedAnswerKey: startData.signedAnswerKey,
      status: "submitted",
    }),
  });

  if (!submitRes.ok) {
     console.error("Submit error", await submitRes.text());
     return;
  }

  const submitData = await submitRes.json();
  console.log(`[4] Result:`, submitData);

  const { data: latestAttempt } = await client.from("cbt_attempts").select("*").eq("student_roll_number", roll).order("created_at", { ascending: false }).limit(1).single();
  console.log(`[5] DB answers column:`, latestAttempt?.answers);
  
  const { data: answers } = await client.from("cbt_attempt_answers").select("*").eq("attempt_id", latestAttempt.id).eq("question_id", q1).single();
  console.log(`[5] DB cbt_attempt_answers for ${q1}:`, answers);
}

testSubmitFlow();
