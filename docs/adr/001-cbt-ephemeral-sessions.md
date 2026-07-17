# ADR 001: Separation of Ephemeral Session State from Final CBT Attempts

## Status
Approved

## Context & Problem Statement
To implement server-side autosave and cross-device resume (Sprint 1: CBT Reliability), we needed to store in-progress exam states continuously. The existing `cbt_attempts` table is used for finalized, submitted exams. It enforces strict invariants such as `NOT NULL` constraints on `score`, `submitted_at`, and `accuracy`.

We needed to decide whether to:
1. Extend `cbt_attempts` to support a "draft" state (meaning loosening `NOT NULL` constraints or creating complex conditional triggers).
2. Create dedicated tables specifically for active, ephemeral sessions.

Additionally, we had to decide how to store granular question state. Should it be a `jsonb` column, or normalized relationally?

## Decision
We elected to **create a dedicated relational schema for in-progress sessions**: `cbt_sessions`, `cbt_session_answers`, and `cbt_operation_log`. 

1. **Separation of Domains:** `cbt_sessions` handles the ephemeral "in-progress" domain. Upon successful submission, data is transformed and finalized into the permanent `cbt_attempts` table.
2. **Relational vs. JSON:** We modeled `cbt_session_answers` relationally (one row per question per session). This moves away from opaque JSON blobs for granular state (`time_spent_ms`, `visited`, `marked_for_review`).

## Consequences

### Positive
* **No Schema Pollution:** The final `cbt_attempts` and `cbt_results` schemas remain pristine. Their analytics integrity is unaffected by autosave glitches or abandoned attempts.
* **Future Analytics Capability:** Because answers and time-spent are relational, future analytics queries (e.g., "What was the average time spent on question X?") are trivial SQL operations instead of expensive JSON parsing.
* **Security & Pruning:** Active sessions can be easily identified and pruned (e.g., deleting rows older than 7 days) without affecting historical records.

### Negative
* **Migration Overhead:** Requires maintaining parallel schemas for in-progress vs. submitted state.
* **High Write Throughput:** A relational design means executing debounced `UPSERT` queries per question per student, which demands careful API optimization (e.g., Postgres RPC batching) in high-load scenarios.
