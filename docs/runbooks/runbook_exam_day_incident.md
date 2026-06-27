# Runbook: Exam Day Incident

This runbook is your primary guide for "Code Red" scenarios during a live CBT pilot exam. Use this when institute staff report major, wide-spread problems that disrupt students.

## 1. Triage & Impact Assessment
When an incident is reported, quickly determine the scope:
- **Scope 1 (Fatal):** Nobody can submit the exam. Entire system is down. (503s/504s).
- **Scope 2 (Degraded):** Submissions are slow, some students get errors, but the system is limping.
- **Scope 3 (Post-Exam):** Everyone submitted, but Analytics are totally stalled or broken.

## 2. Immediate Diagnostic Steps
Run `npm run verify:production`.

**If API is down / Users can't submit:**
- Check Vercel/Next.js dashboard for 500 errors.
- Refer to `runbook_database_outage.md` immediately to check connection pool limits.

**If Queue Backlog Explodes (Scope 3):**
- Check if worker is running.
- Refer to `runbook_worker_stuck.md`.

## 3. Communication Templates

**Initial Acknowledgment (within 5 minutes):**
> "We are currently investigating reports of [submission failures/slow loading]. The engineering team is actively diagnosing the issue. We advise students to remain on the exam screen and not refresh. Next update in 15 minutes."

**Status Update (during active resolution):**
> "We have identified the bottleneck in [the database layer/queue]. We are currently applying a fix/restarting the servers. Do NOT have students exit the app; their local caches are safe. Next update in 15 minutes."

**Post-Incident Clearance:**
> "The system is fully restored. All queued submissions have successfully synced. Analytics generation is catching up and will be available shortly. Thank you for your patience."

## 4. Rollback & Emergency Procedures

### Extending the Exam Timer
If an outage ate 10 minutes of exam time, you must extend the exam globally for that institute.
```sql
UPDATE exams
SET duration_minutes = duration_minutes + 15
WHERE id = '<exam-id>';
```
*(Note: If students are already on the exam screen, this may require them to refresh to see the new timer. Communicate this clearly to the institute).*

### Forcing Auto-Submit
If the network drops entirely at the end of the exam, student devices will fail to reach the server. The data remains in `localStorage`. Once they regain network, the PWA will attempt to sync. Instruct institutes: "Have students reconnect to Wi-Fi and open the app; the offline-sync will push their answers automatically."

## 5. Post-Mortem Requirements
After the incident, you must document:
1. What was the exact trigger? (e.g., Load spike).
2. What metrics missed this? (e.g., No alert for connections > 90%).
3. How will we prevent this in the next pilot?
