# Runbook: Database Outage

This runbook covers scenarios where the Supabase Postgres database becomes unresponsive, hits connection limits, or experiences hardware failure during an exam.

## 1. Symptoms
- High API latency (>5s) across all routes.
- 503 or 504 Gateway Timeouts from the Next.js API.
- Logs show `remaining connection slots are reserved for non-replication superuser connections` or `terminating connection due to administrator command`.
- `npm run verify:production` fails or times out.
- Next.js application throws `PrismaClientInitializationError` or Supabase `PGRST` connection timeout errors.

## 2. Diagnosis

### Check Connection Pool (PgBouncer)
Run the following via Supabase Dashboard SQL Editor or direct connection:
```sql
SELECT sum(numbackends) FROM pg_stat_database;
```
If this approaches your connection limit (e.g., 500 connections for smaller Supabase tiers), the pool is exhausted.

### Check CPU/Memory
Navigate to **Supabase Dashboard -> Database -> Health**.
Look for CPU spikes > 90% or RAM > 95%.

### Check Active Locks
```sql
SELECT pid, usename, pg_blocking_pids(pid) AS blocked_by, query AS blocked_query
FROM pg_stat_activity
WHERE cardinality(pg_blocking_pids(pid)) > 0;
```

## 3. Recovery Steps

### Scenario A: Connection Exhaustion (Spike)
**Action:** Let it ride if transient, or restart the server pool if stuck.
1. If the spike is legitimate (e.g., 500 students submitting exactly at the buzzer), Supabase PgBouncer will queue requests. **DO NOT** restart immediately; the queue will clear in 1-2 minutes.
2. If connections are orphaned/stuck (queries hanging for >5 minutes), forcefully kill idle connections:
```sql
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle' AND state_change < current_timestamp - INTERVAL '5 minutes';
```

### Scenario B: Database Server Down (Supabase Outage)
**Action:** Wait for upstream recovery or trigger Point-in-Time Recovery (PITR).
1. Check [Supabase Status](https://status.supabase.com/).
2. If hardware failure, execute a PITR restore from the Supabase Dashboard to the last minute before the crash.

### Scenario C: Rogue Query / Deadlocks
**Action:** Kill the blocking process.
1. Find the PID from the active locks query above.
2. Run `SELECT pg_terminate_backend(<pid>);`

## 4. Post-Recovery Verification
1. Run `npm run verify:production`.
2. Ensure API routes respond within 500ms.
3. Review `analytics_jobs` to ensure queued jobs resumed processing.

## 5. Escalation Path
If DB remains unresponsive for >10 minutes during a live exam:
1. Escalate to DevOps / Supabase Support.
2. Trigger the "Exam Day Incident" communication template (see `runbook_exam_day_incident.md`).
