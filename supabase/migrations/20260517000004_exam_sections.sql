-- ExamGrid migration 5/7: exam_sections
create table if not exists public.exam_sections (
  id text not null,
  exam_id uuid not null references public.exams (id) on delete cascade,
  institute_id uuid not null references public.institutes (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (exam_id, id)
);

create index if not exists exam_sections_exam_id_idx on public.exam_sections (exam_id);
create index if not exists exam_sections_institute_id_idx on public.exam_sections (institute_id);

comment on table public.exam_sections is 'Section layout for an exam paper';
