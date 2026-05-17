-- ExamGrid: students (candidates per institute)

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

create index if not exists students_institute_id_idx on public.students (institute_id);
create index if not exists students_roll_number_idx on public.students (institute_id, roll_number);

comment on table public.students is 'Exam candidates scoped to an institute';
