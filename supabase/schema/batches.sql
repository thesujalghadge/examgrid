-- ExamGrid: institute batches

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

create index if not exists batches_institute_idx on public.batches (institute_id);
create index if not exists batches_active_idx on public.batches (institute_id, is_active);

comment on table public.batches is 'Operational student batches scoped to an institute';
