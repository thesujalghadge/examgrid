-- ExamGrid Phase 5: institute operational workflows

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete cascade,
  name text not null,
  roll_number text not null,
  application_number text not null,
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institute_id, roll_number)
);

alter table public.students
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists course_type text not null default 'JEE',
  add column if not exists batch_id uuid,
  add column if not exists is_active boolean not null default true;

update public.students
set full_name = coalesce(full_name, name)
where full_name is null;

alter table public.students
  alter column full_name set not null;

create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete cascade,
  name text not null,
  course_type text not null,
  academic_year text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institute_id, name, academic_year)
);

alter table public.students
  drop constraint if exists students_batch_id_fkey,
  add constraint students_batch_id_fkey
    foreign key (batch_id) references public.batches (id) on delete set null;

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

create index if not exists batches_institute_idx on public.batches (institute_id);
create index if not exists batches_active_idx on public.batches (institute_id, is_active);
create index if not exists students_batch_id_idx on public.students (batch_id);
create index if not exists exam_schedules_institute_idx on public.exam_schedules (institute_id);
create index if not exists exam_schedules_exam_idx on public.exam_schedules (exam_id);
create index if not exists exam_schedule_batches_batch_idx on public.exam_schedule_batches (batch_id);

alter table public.students enable row level security;
alter table public.batches enable row level security;
alter table public.exam_schedules enable row level security;
alter table public.exam_schedule_batches enable row level security;

drop policy if exists "dev_students_all" on public.students;
drop policy if exists "dev_batches_all" on public.batches;
drop policy if exists "dev_exam_schedules_all" on public.exam_schedules;
drop policy if exists "dev_exam_schedule_batches_all" on public.exam_schedule_batches;

create policy "dev_students_all" on public.students for all using (true) with check (true);
create policy "dev_batches_all" on public.batches for all using (true) with check (true);
create policy "dev_exam_schedules_all" on public.exam_schedules for all using (true) with check (true);
create policy "dev_exam_schedule_batches_all" on public.exam_schedule_batches for all using (true) with check (true);
