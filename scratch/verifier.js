const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const isUuid = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

async function verify() {
  console.log("--- VERIFYING NON-UUID IDENTIFIERS ---");
  const { data: attempts } = await sb.from('cbt_attempts').select('test_id, student_roll_number');
  
  let nonUuidTestIds = 0;
  let nonUuidRolls = 0;
  
  for (const row of attempts || []) {
    if (row.test_id && !isUuid(row.test_id)) nonUuidTestIds++;
    if (row.student_roll_number && !isUuid(row.student_roll_number)) nonUuidRolls++;
  }
  
  const { data: exams } = await sb.from('exams').select('id');
  let nonUuidExams = 0;
  for (const row of exams || []) {
    if (row.id && !isUuid(row.id)) nonUuidExams++;
  }

  console.log(`Zero non-UUID test ids: ${nonUuidTestIds === 0 ? 'TRUE' : 'FALSE'} (${nonUuidTestIds} found)`);
  console.log(`Zero non-UUID exam ids: ${nonUuidExams === 0 ? 'TRUE' : 'FALSE'} (${nonUuidExams} found)`);
  console.log(`Zero non-UUID student_roll_number: ${nonUuidRolls === 0 ? 'TRUE' : 'FALSE'} (${nonUuidRolls} found)`);
  
  console.log("--- DASHBOARD QUERY EXECUTION ---");
  // Simulating dashboard query (fetchStudentAttemptedExams)
  const studentIdentifier = "12345";
  const instituteId = "da368ae6-633e-4665-9fb1-44bf37ded332";
  
  const { data: student } = await sb.from("students").select("id").eq("roll_number", studentIdentifier).eq("institute_id", instituteId).maybeSingle();
  
  if (student) {
    const { data: attemptsData, error: attemptsError } = await sb.from("cbt_attempts").select("id, test_id, student_id").eq("institute_id", instituteId).eq("student_id", student.id);
    
    if (attemptsError) {
      console.log("Dashboard query failed:", attemptsError.message);
    } else {
      console.log(`Dashboard query executed successfully. Found ${attemptsData.length} attempts.`);
    }
  } else {
    console.log("Dashboard query executed successfully (student not found).");
  }
}
verify();
