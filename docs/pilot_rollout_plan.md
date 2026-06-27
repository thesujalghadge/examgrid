# ExamGrid Pilot Rollout Plan

## Phase 1
* **Scope**: Internal dry run
* **Scale**: 50 simulated students
* **Objective**: Observe metrics and logs in a controlled environment to ensure staging/production parity.

## Phase 2
* **Scope**: One institute, one low-risk exam
* **Scale**: 50–100 students
* **Objective**: Validate end-to-end user experience and monitor queue stability with real users.

## Phase 3
* **Scope**: Three institutes
* **Scale**: ~300 students
* **Objective**: Observe queue throughput and Time-To-Analytics (TTA) under sustained, distributed load.

## Phase 4
* **Scope**: Five institutes
* **Scale**: ~500 students (Full Pilot Rollout)
* **Objective**: Validate the 500-user burst capacity established during engineering load tests.

## Success Criteria
* **Submission P95 Latency**: `< 2s`
* **Error Rate**: `< 1%`
* **Data Corruption**: `0`
* **Analytics SLA**: Available within target window
* **Operations**: No manual intervention required
