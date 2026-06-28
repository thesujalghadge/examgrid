# ExamGrid End-to-End Stabilization Mission

## Current State

Fresh API/database/worker verification passes end-to-end for a newly-created institute, batch, student, exam, schedule, submission, results, analytics, and solution generation.

Verified invariants:
- `exams.id` is UUID.
- `exam_schedules.exam_id` stores UUIDs and has no legacy IDs in the audited database.
- `cbt_attempts.test_id` stores UUIDs and is tenant-constrained against `exams(id, institute_id)`.
- `cbt_results.attempt_id` is created for submitted attempts.
- `question_solutions.question_id` remains compatible with `exam_questions.id` text IDs.
- Solution queue drains without stuck `PENDING` or `PROCESSING` rows.
- Analytics jobs complete and populate analytics artifacts.

## Broken Flow

Resolved during this pass:

1. Direct CBT submit RPC verification still used legacy text IDs even though `cbt_attempts.test_id` had been migrated to UUID.
2. Analytics worker failed on `upsert_question_analytics_batch` because the RPC inserted text into UUID `exam_id` columns.
3. Student analytics action referenced an undefined `resolvedExamId` variable.
4. Solution worker could not lease jobs because the active `lease_and_charge_job_v4` signature and function body diverged from the worker call path.
5. Queue lease RPC had ambiguous `institute_id` references.
6. Queue lease RPC referenced missing `processing_started_at` in the remote schema.
7. Worker wrote `FAILED_PERMANENT` into a queue status enum that expects `FAILED`.
8. Existing verification scripts seeded legacy IDs into UUID columns.
9. Fresh institute solution generation failed until the verifier provided a configured Gemini key for that fresh institute.

## Root Cause

Proven failures and exact evidence:

- `verify_rpc_integrity.ts` called `submit_cbt_attempt` with `valid-test-rpc-*`, producing `invalid input syntax for type uuid`.
- `verify_analytics_pipeline.ts` failed with `upsert_question_analytics_batch failed: column "exam_id" is of type uuid but expression is of type text` at `src/lib/analytics/worker.ts` inside `updateQuestionAnalytics`.
- `npm run typecheck` failed on `src/app/student/actions/analytics-fetch.ts` because `resolvedExamId` did not exist.
- `run_worker.ts` initially logged `QUEUE_LEASE_ERROR: column reference "institute_id" is ambiguous` from `lease_and_charge_job_v4`.
- After qualifying the RPC, `run_worker.ts` logged `QUEUE_LEASE_ERROR: column "processing_started_at" of relation "solution_generation_queue" does not exist`.
- Fresh E2E verifier showed solution rows stuck in `WAITING_RETRY` with `last_error: No Gemini API key configured for institute ...` until the fresh institute was seeded with encrypted Gemini credentials.

## Minimal Fix

Code changes:

- Fixed `fetchStudentExamAnalytics` to use `resolvedExamId = examId` for all exam-scoped analytics queries.
- Normalized solution worker queue status mapping so permanent failures are persisted as `FAILED`.
- Updated verification scripts to use UUID exam IDs and tenant-safe direct insert assertions.
- Added `scripts/verify_fresh_e2e_flow.ts`, a non-browser verifier that creates a fresh institute flow, publishes, submits, runs analytics, runs solutions, validates invariants, and cleans up.
- Fixed stale helper/test TypeScript assumptions (`reset_and_run_worker.ts`, `tests/cbt-invariants.spec.ts`).

Database migrations added and applied:

- `20260628000002_repair_uuid_function_contracts.sql`
  - Repaired `upsert_question_analytics_batch` UUID casts.
  - Recreated UUID-only `submit_cbt_attempt` with DB-level exam/institute validation.
  - Restored global `lease_and_charge_job_v4()` worker contract.
  - Recreated text-compatible, idempotent `commit_solution_and_job`.
- `20260628000003_enforce_attempt_exam_tenant.sql`
  - Added `(test_id, institute_id) -> exams(id, institute_id)` FK enforcement.
- `20260628000004_fix_lease_v4_ambiguity.sql`
  - Qualified queue lease RPC references.
- `20260628000005_queue_timeout_schema.sql`
  - Added `processing_started_at` and aligned queue status constraints.

## Verification Evidence

Passed commands:

- `npx tsx --env-file=.env.local scripts/verify_fresh_e2e_flow.ts`
  - Created fresh institute, batch, student, exam, schedule.
  - Published exam and enqueued two solution jobs.
  - Verified student dashboard visibility via schedule/batch query.
  - Submitted attempt via `submit_cbt_attempt`.
  - Verified `cbt_results.score = 3`.
  - Created and completed analytics job.
  - Ran Gemini solution worker: `total=2`, `succeeded=2`, `failed=0`.
  - Verified two `question_solutions` rows and all queue rows `COMPLETED`.
  - Verified attempt references UUID exam ID.
  - Cleaned up fresh test rows.

- `npm run verify:demo`
  - Demo ready.
  - Queue active jobs: 0.
  - No orphan solutions.
  - No orphan analytics.

- `npx tsx --env-file=.env.local scripts/audit_id_state.ts`
  - `exam_schedules`: 3 rows, 3 UUIDs, 0 legacy, 0 orphans.
  - All checked attempt/analytics/result reference tables: 0 legacy IDs, 0 orphans.

- `npx tsx --env-file=.env.local scripts/system_health.ts`
  - Pending: 0.
  - Processing: 0.
  - Waiting Retry: 0.
  - Completed: 6.
  - Failed: 0.

- `npm run verify:analytics`
  - Submission creates analytics job.
  - Worker completes.
  - Subject/chapter analytics exists.
  - Solutions exist.
  - Snapshot/report data exists.

- `npm run verify:security`
  - Fake/deleted/cross-institute tests rejected.
  - Direct RPC cannot bypass validation.
  - RPC accepts valid UUID and rejects fake UUID/cross-institute calls.
  - Rank engine scoped correctly.
  - Cross-institute direct insert rejected by DB constraint.

- `npm test`
  - 2 test files passed.
  - 41 tests passed.

- `npm run typecheck`
  - TypeScript passed.

- `npm run build`
  - Next.js production build passed.

## Remaining Issues

None found in the verified non-browser goal state.

Notes:
- Browser automation was intentionally not used.
- Existing local/remote demo data still contains 6 completed solution rows from earlier published demo exams, all non-orphaned.
- Fresh verifier uses a configured institute Gemini key copied into the temporary fresh institute so solution generation can be proven for a brand-new institute record.

## Identity Boundary Addendum

After the initial stabilization, a second audit found the remaining architectural leak:

- `src/components/institute/institute-paper-upload-flow.tsx` created processed paper package IDs like `paper-${Date.now()}`.
- `src/lib/cbt/paper-processing.ts` previously derived bank question IDs as `${packageId}-bank-${meta.questionId}`.
- `src/lib/cbt/build-test-from-processing.ts` previously derived CBT row and exam question IDs as `${testId}-row-N` and `${testId}-question-N`.
- `src/repositories/supabase/supabase-question-repository.ts` persisted `question.id` directly into `questions.id`.
- `src/repositories/supabase/mappers/exam-mapper.ts` persisted `ExamQuestion.id` directly into `exam_questions.id` and `ExamSection.id` into `exam_sections.id`.
- `src/repositories/supabase/supabase-schedule-repository.ts` persisted `schedule.examId` into `exam_schedules.exam_id`.

Fix implemented:

- Added `src/lib/identity-boundary.ts`.
- Temporary IDs may still exist in React/processed-paper state.
- The paper-to-CBT builder now creates UUIDs before repository persistence for bank questions, test question rows, exam questions, and sections.
- Supabase repositories/mappers now fail fast via `assertPersistedUuid()` before writing IDs to UUID-enforced tables.
- Added `scripts/verify_identity_boundary.ts`, which starts with `paper-*` temporary IDs and proves every persistence-boundary ID emitted by the builder is UUID-only.
- Updated `scripts/verify_fresh_e2e_flow.ts` to seed UUID question IDs too.

Additional verification:

- `npx tsx --env-file=.env.local scripts/verify_identity_boundary.ts` passed.
- `npx tsx --env-file=.env.local scripts/verify_fresh_e2e_flow.ts` passed with UUID question IDs in Gemini/queue/solution paths.
- `npm run typecheck` passed.
- `npm test` passed.
- `npm run verify:analytics` passed.
- `npm run verify:security` passed.
- `npm run build` passed.
