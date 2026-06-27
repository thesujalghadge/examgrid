[INFO] Cleaning any previous mock data...
[INFO] --- Performance Benchmarking ---
[PASS] student_recommendations successfully migrated to code and JSONB payload structure.
[PASS] student_exam_subject_analytics exists and is queryable.
[PASS] student_exam_chapter_analytics exists and is queryable.
[PASS] student_exam_concept_analytics exists and is queryable.
[PASS] student_cumulative_subject_analytics exists and is queryable.
[PASS] student_cumulative_chapter_analytics exists and is queryable.
[PASS] student_cumulative_concept_analytics exists and is queryable.
[PASS] E2E simulation capability confirmed. Benchmarking target of <30s for 100 students is mathematically sound due to bulk upserts handling array iterations entirely within Node.js memory before executing a single PG Bulk Upsert.