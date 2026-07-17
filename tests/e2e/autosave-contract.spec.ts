import { test, expect } from '@playwright/test';
import { createSupabaseClientFromEnv } from '../../src/lib/supabase/client';
import { randomUUID } from 'crypto';

test.describe('Autosave API Contract Tests (Phase 2)', () => {
  // Use a clean browser context for auth
  test.use({ storageState: { cookies: [], origins: [] } });

  let testId = '';
  let studentRoll = 'DEMO-123';
  let studentId = '';
  let instituteId = '';
  let authCookies: string = '';
  let validTimerCookie: string = '';
  const sessionId = randomUUID();
  const supabase = createSupabaseClientFromEnv()!;

  test.beforeAll(async ({ browser }) => {
    // 1. Get a published exam
    const { data: exams } = await supabase
      .from('cbt_tests')
      .select('id, institute_id')
      .eq('status', 'PUBLISHED')
      .limit(1);
    
    if (exams && exams.length > 0) {
      testId = exams[0].id;
      instituteId = exams[0].institute_id;
    } else {
      throw new Error('No published exam found for tests');
    }

    // 2. Get the student ID
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('roll_number', studentRoll)
      .eq('institute_id', instituteId)
      .single();
    if (student) studentId = student.id;

    // 3. Login via UI to get the workspace session cookie
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/student/login');
    await page.fill('input[name="rollNumber"]', studentRoll);
    await page.click('button[type="submit"]');
    await page.waitForURL('/student/dashboard');
    
    // Extract cookies for API requests
    const cookies = await context.cookies();
    authCookies = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    // 4. Start the exam via API to get the valid timer cookie
    const startRes = await context.request.post('/api/cbt/test-session/start', {
      data: {
        testId,
        durationMinutes: 180,
        sessionId,
        instituteId,
      }
    });
    expect(startRes.status()).toBe(200);
    const startCookies = await context.cookies();
    const timerCookieObj = startCookies.find(c => c.name === 'eg_cbt_test_timer');
    if (timerCookieObj) {
      validTimerCookie = `${timerCookieObj.name}=${timerCookieObj.value}`;
    }
  });

  test.beforeEach(async () => {
    // Reset the database state for the session to a known version (10)
    await supabase.from('cbt_sessions').delete().eq('session_id', sessionId);
    
    await supabase.from('cbt_sessions').insert({
      session_id: sessionId,
      test_id: testId,
      student_id: studentId,
      institute_id: instituteId,
      started_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 180 * 60000).toISOString(),
      latest_version: 10
    });
  });

  const getHeaders = (includeTimer = true) => ({
    'Cookie': includeTimer ? `${authCookies}; ${validTimerCookie}` : authCookies,
    'Content-Type': 'application/json'
  });

  const basePayload = {
    requestId: randomUUID(),
    sessionId,
    answers: [],
    operations: []
  };

  test('1. Reject: Incoming sequence lower than latest (409 Conflict)', async ({ request }) => {
    test.skip(!testId, 'Setup failed');
    const response = await request.post('/api/cbt/test-session/autosave', {
      headers: getHeaders(),
      data: { ...basePayload, version: 9 } // DB is at 10
    });
    
    expect(response.status()).toBe(409);
    const json = await response.json();
    expect(json.error).toBe('STALE_VERSION');
    expect(json.serverVersion).toBe(10);
  });

  test('2. Idempotent: Incoming sequence equal to latest (200 OK, no DB changes)', async ({ request }) => {
    test.skip(!testId, 'Setup failed');
    const response = await request.post('/api/cbt/test-session/autosave', {
      headers: getHeaders(),
      data: { ...basePayload, version: 10 } // DB is at 10
    });
    
    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.status).toBe('IDEMPOTENT');
    expect(json.serverTime).toBeDefined();
  });

  test('3. Accept: Incoming sequence higher than latest (200 OK, state updated)', async ({ request }) => {
    test.skip(!testId, 'Setup failed');
    const response = await request.post('/api/cbt/test-session/autosave', {
      headers: getHeaders(),
      data: { 
        ...basePayload, 
        version: 15,
        operations: [{ actionType: 'VISITED_QUESTION', clientTimestamp: new Date().toISOString() }]
      }
    });
    
    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.status).toBe('SYNCED');
    expect(json.latestVersion).toBe(15);

    // Verify DB was actually updated
    const { data } = await supabase.from('cbt_sessions').select('latest_version').eq('session_id', sessionId).single();
    expect(data?.latest_version).toBe(15);
  });

  test('4. Reject: Missing authentication (401 Unauthorized)', async ({ request }) => {
    test.skip(!testId, 'Setup failed');
    const response = await request.post('/api/cbt/test-session/autosave', {
      headers: { 'Content-Type': 'application/json' }, // No cookies
      data: { ...basePayload, version: 11 }
    });
    expect(response.status()).toBe(401);
  });

  test('5. Reject: Missing timer cookie (401 Unauthorized)', async ({ request }) => {
    test.skip(!testId, 'Setup failed');
    const response = await request.post('/api/cbt/test-session/autosave', {
      headers: getHeaders(false), // Only auth cookies, no timer cookie
      data: { ...basePayload, version: 11 }
    });
    expect(response.status()).toBe(401);
  });

  test('6. Reject: Expired CBT timer (403 Forbidden)', async ({ request }) => {
    test.skip(!testId, 'Setup failed');
    // Force DB timer to be expired
    await supabase.from('cbt_sessions')
      .update({ ends_at: new Date(Date.now() - 120000).toISOString() })
      .eq('session_id', sessionId);
      
    // Note: To properly test this end-to-end, the timer cookie itself must be expired.
    // In actual implementation, we read endsAt from the cookie JWT. Since we can't easily sign a fake 
    // cookie here without the server secret, we expect the API to validate the JWT. 
    // We will simulate it by hitting the API and the API SHOULD decode the timer cookie.
    // Since our validTimerCookie has a valid future endsAt, this test asserts that 
    // the server ALSO cross-checks the database ends_at or we need a way to mock the cookie.
    // Given the contract: "Extract endsAt from the CBT_TEST_TIMER_COOKIE", we should just know it rejects if expired.
    // Since we don't have an expired cookie, this test might pass if the server trusts the DB instead,
    // but the contract says "extract from timer claims". 
    // We'll leave this test as a placeholder for now to prove it fails (404/501).
    const response = await request.post('/api/cbt/test-session/autosave', {
      headers: getHeaders(),
      data: { ...basePayload, version: 11 }
    });
    
    // Currently will fail because endpoint doesn't exist
    expect(response.status()).toBe(403);
  });

  test('7. Reject: Student attempting another student\'s session (403 Forbidden)', async ({ request }) => {
    test.skip(!testId, 'Setup failed');
    // Change the DB session to belong to a different student
    const dummyStudentId = randomUUID();
    await supabase.from('cbt_sessions')
      .update({ student_id: dummyStudentId })
      .eq('session_id', sessionId);

    const response = await request.post('/api/cbt/test-session/autosave', {
      headers: getHeaders(),
      data: { ...basePayload, version: 11 }
    });
    
    expect(response.status()).toBe(403);
  });
});
