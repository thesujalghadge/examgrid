# ADR 005: Evolution of Repository Hydration & Asynchronous Interfaces

## Status
Accepted

## Context
ExamGrid originally used a synchronous `localStorage` backend for rapid prototyping. To support this, repositories (e.g., `StudentRepository`, `ExamRepository`, `QuestionRepository`) exposed synchronous APIs (like `.list()` or `.getById()`). 

When migrating to Supabase, these interfaces were preserved to avoid rewriting the entire UI layer. A stop-gap solution was implemented: `hydrateSupabaseRepositories()`. This function eagerly downloaded the *entirety* of every table (all questions, all students, all batches) into a synchronous, in-memory cache upon application load.

As the platform scales (especially with `questions` growing into the tens of thousands with rich HTML strings), this global eager hydration introduces a massive startup cost, exhausts the Supabase connection pool, and causes out-of-memory issues in the browser.

## Decision
1. **Legacy Compatibility Layer:** The current synchronous repository cache architecture (`list()`, `getById()`, etc., backed by an in-memory array) is officially designated as a **legacy compatibility layer**. It exists solely to support the existing synchronous UI components.
2. **Lightweight Bootstrap Hydration:** We will continue to globally hydrate "lightweight" metadata repositories (`students`, `batches`, `exams`, `schedules`) at the session boundary (`SessionHydrationGate`). This ensures dashboards render instantly without blocking.
3. **Lazy Hydration for Heavy Entities:** Large entities, most notably `questions`, have been removed from the global bootstrap hydration. They are now lazily hydrated only when requested by the CBT engine or authoring tools via async methods (`getBankQuestionsAsync`).
4. **Future Repositories:** All *new* repositories and data access patterns MUST expose asynchronous interfaces (`Promise`) and query Supabase directly, rather than relying on global in-memory caching.

## Consequences
- **Positive:** Significant reduction in initial load time and memory footprint for the Institute and Student portals. Eliminates "blank screen" bugs caused by unhydrated caches.
- **Positive:** Establishes a clear path forward for migrating components to React Server Components or async data fetching (e.g., React Query).
- **Negative:** The codebase will temporarily contain a mix of synchronous legacy repository calls and new asynchronous data fetching until the legacy layer is fully deprecated.
