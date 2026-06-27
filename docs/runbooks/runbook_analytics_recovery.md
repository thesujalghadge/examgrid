# Runbook: Failed Analytics Recovery

This runbook covers how to recover when the analytics pipeline correctly processes a job but encounters an error (e.g., schema mismatch, bad mapping data) resulting in a `FAILED` status.

## 1. How to Inspect Errors

Failed jobs are honest—they record the exact Postgres or Node exception in the database.

**Find recent failures:**
```sql
SELECT id, attempt_id, error_text, created_at
FROM analytics_jobs
WHERE status = 'FAILED'
ORDER BY updated_at DESC
LIMIT 20;
```

**Common Causes:**
- **Foreign Key Violation:** The `batch_id` or `institute_id` on the student doesn't match the syllabus mappings.
- **Null Reference:** A query unexpectedly returned 0 rows because an exam was hard-deleted mid-processing.
- **Missing completed_at:** Job threw an error at the final completion milestone.

## 2. How to Requeue

Once the underlying bug or data issue has been resolved (e.g., you patched the worker or restored the missing exam data), you must manually requeue the jobs.

**Bulk Requeue all failures from the last 24h:**
```sql
UPDATE analytics_jobs
SET status = 'PENDING', error_text = NULL
WHERE status = 'FAILED'
AND created_at > NOW() - INTERVAL '24 hours';
```

**Requeue a specific job:**
```sql
UPDATE analytics_jobs
SET status = 'PENDING', error_text = NULL
WHERE id = '<job-id>';
```

## 3. How to Verify Recovery

1. Wait 1-2 minutes for the background worker to consume the `PENDING` jobs.
2. Run `npm run verify:production` to check if `Failed jobs in last 24h` dropped to 0.
3. Query the job history directly to ensure it transitioned to `COMPLETED`:
```sql
SELECT status, completed_at
FROM analytics_jobs
WHERE id = '<job-id>';
```
4. Verify the artifacts physically exist:
```sql
SELECT COUNT(*) FROM student_exam_subject_analytics WHERE job_id = '<job-id>'; -- Or check by student_id
SELECT COUNT(*) FROM analytics_snapshots WHERE student_id = '<student-id>';
```
