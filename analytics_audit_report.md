[INFO] --- 1. Database Verification ---
[PASS] analytics_jobs table exists. Found 0 jobs.
[PASS] cbt_results contains rank, percentile, correct_count, etc.
[INFO] --- 2. Student Analytics Verification ---
[PASS] student_subject_analytics table exists and is accessible.
[PASS] student_chapter_analytics table exists and is accessible.
[PASS] student_concept_analytics table exists and is accessible.
[PASS] analytics_snapshots table exists and is accessible.
[PASS] student_recommendations table exists and is accessible.
[INFO] --- 3. Question Analytics Verification ---
[PASS] question_analytics table exists.
[INFO] --- 4. Performance Benchmarking ---
[INFO] Note: Active benchmarking requires the worker to be running or tested. We'll skip deep load generation in this basic static check to avoid polluting production DB, but the tables are ready for load.
[INFO] --- 5. Failure Verification ---
[PASS] analytics_jobs correctly rejects invalid statuses.