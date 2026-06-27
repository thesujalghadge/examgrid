# Pre-Pilot Checklist: Exam Identity Unification

**Status:** ⚠️ P1 Architectural Debt (Blocking Pilot Onboarding)
**Context:** The system currently maintains a dual-identity model for exams (`legacy_id` text strings vs `id` UUIDs). This prevents explicit Foreign Key constraints and requires fragile dual-path routing (Regex/Fallback) in application logic, leading to `PGRST200` errors.

### Objective
Unify the exam identity model so that **one exam has exactly one UUID identity everywhere in the system.**

---

### Migration Steps (Database)

#### [ ] Step 1: Identify Legacy Attempts
```sql
SELECT id, test_id FROM cbt_attempts WHERE test_id !~* '^[0-9a-f-]{36}$';
```

#### [ ] Step 2: Map Legacy IDs to Exam UUIDs
```sql
SELECT ca.id, ca.test_id, e.id AS exam_uuid
FROM cbt_attempts ca
JOIN exams e ON e.legacy_id = ca.test_id;
```

#### [ ] Step 3: Execute Backfill
```sql
UPDATE cbt_attempts ca
SET test_id = e.id::text
FROM exams e
WHERE e.legacy_id = ca.test_id;
```

#### [ ] Step 4: Verify Backfill Integrity
```sql
SELECT * FROM cbt_attempts WHERE test_id !~* '^[0-9a-f-]{36}$';
-- Must return 0 rows.
```

#### [ ] Step 5: Enforce Foreign Key & Type Constraint
```sql
ALTER TABLE cbt_attempts
ALTER COLUMN test_id TYPE uuid
USING test_id::uuid;

ALTER TABLE cbt_attempts
ADD CONSTRAINT cbt_attempts_test_id_fkey
FOREIGN KEY (test_id)
REFERENCES exams(id);
```

---

### Application Refactoring

#### [ ] Step 6: Update RPC Signatures
Update all database RPCs (e.g., `submit_cbt_attempt`, `get_cbt_submission`, `list_cbt_submissions`, `log_telemetry_event`) to cast `p_test_id` from `text` to `uuid`.

#### [ ] Step 7: Purge Legacy Lookups
Remove dual-ID support from the application codebase. For example, revert `src/app/student/actions/analytics-fetch.ts` to use a direct single-query `.select()` using the newly enforced Foreign Key relationships.
