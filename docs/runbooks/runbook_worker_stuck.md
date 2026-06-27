# Runbook: Worker Stuck

This runbook addresses scenarios where the background analytics worker stops processing the queue, resulting in missing reports and dashboards for students.

## 1. How to Detect
- Students complain that "Solutions are not generating" or "Report is missing" long after exam completion.
- `npm run verify:production` flags `Queue backlog > 50` or `stuck analytics_jobs`.
- The following query returns rows:
```sql
SELECT id, attempt_id, updated_at
FROM analytics_jobs
WHERE status = 'PROCESSING'
AND updated_at < NOW() - INTERVAL '30 minutes';
```

## 2. Diagnosis

### Check Vercel/Node Worker Logs
Determine if the worker loop itself has crashed or if jobs are silently timing out.
If running via CRON or Vercel edge functions, check the execution logs. If you see memory limits hit (`Memory Limit Exceeded`) or execution timeouts (Vercel limits), the worker died mid-job.

### Verify Infinite Loops / Hanging Promises
If the logs show the worker fetched a job but never updated it to `FAILED` or `COMPLETED`, the node process may be stuck on an unresolved Promise (e.g., an external API call without a timeout or a bad Supabase connection).

## 3. How to Restart

If the worker is a standalone Node process:
1. SSH into the worker server (or use PM2).
2. `pm2 restart examgrid-worker` (or equivalent).
3. Monitor logs using `pm2 logs`.

If the worker is Serverless/Cron:
1. Ensure the trigger endpoint is healthy.
2. Manually trigger the queue processing route.

## 4. How to Replay Jobs safely

Any jobs stuck in `PROCESSING` forever are dead. They must be reverted to `PENDING` so the next worker loop picks them up.

```sql
-- Safely revert dead jobs
UPDATE analytics_jobs
SET status = 'PENDING', error_text = 'System: Manually reverted stuck job'
WHERE status = 'PROCESSING'
AND updated_at < NOW() - INTERVAL '30 minutes';
```

## 5. Post-Recovery Verification
1. Run `npm run verify:production`.
2. Confirm the "Processing" count decreases steadily.
3. Confirm "Completed" count increases.
