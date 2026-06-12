# ExamGrid Supabase schema setup

## Automated (recommended)

Add to `.env.local` **one** of:

```env
SUPABASE_ACCESS_TOKEN=your-personal-access-token
```

Create token: [Supabase Account → Access Tokens](https://supabase.com/dashboard/account/tokens)

**OR**

```env
SUPABASE_DB_PASSWORD=your-database-password
```

From: Supabase Dashboard → Project Settings → Database

Then run:

```bash
npm run db:bootstrap   # apply migrations
npm run db:verify      # smoke tests + table checks
# or both:
npm run db:setup
```

Migrations live in `supabase/migrations/` (applied in timestamp order by the CLI/API).

## Manual SQL (legacy)

The files in this folder mirror migrations. Prefer `npm run db:bootstrap` instead of copy-paste.

| File | Purpose |
|------|---------|
| `institutes.sql` | `institutes` table |
| `seed.sql` | Default institute row |
| `questions.sql` | Question bank |
| `batches.sql` | Institute batches |
| `exams.sql` | Exam header |
| `exam_sections.sql` | Sections |
| `exam_questions.sql` | Assembled questions |
| `exam_schedules.sql` | Exam windows and batch assignments |
| `cbt_attempt_results.sql` | Server-authoritative CBT attempts, answers, and results |
| `audit_logs.sql` | Operational audit trail |
| `rls-dev.sql` | Dev RLS policies |

## App env

```env
NEXT_PUBLIC_REPOSITORY_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_DEFAULT_INSTITUTE_ID=00000000-0000-0000-0000-000000000001
```

Restart dev server after changes. Verify in **Admin → System Status**.
