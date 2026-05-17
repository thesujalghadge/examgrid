-- ExamGrid: exam scheduling and batch assignment

create table if not exists public.exam_schedules (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete cascade,
  exam_id text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes > 0),
  visibility_rule text not null default 'assigned_batches'
    check (visibility_rule in ('assigned_batches', 'all_active_students')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);

create table if not exists public.exam_schedule_batches (
  schedule_id uuid not null references public.exam_schedules (id) on delete cascade,
  batch_id uuid not null references public.batches (id) on delete cascade,
  institute_id uuid not null references public.institutes (id) on delete cascade,
  primary key (schedule_id, batch_id)
);

create index if not exists exam_schedules_institute_idx on public.exam_schedules (institute_id);
create index if not exists exam_schedules_exam_idx on public.exam_schedules (exam_id);
create index if not exists exam_schedule_batches_batch_idx on public.exam_schedule_batches (batch_id);

comment on table public.exam_schedules is 'Operational exam windows and visibility rules';
