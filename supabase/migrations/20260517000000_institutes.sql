-- ExamGrid migration 1/7: institutes
create extension if not exists "pgcrypto";

create table if not exists public.institutes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  contact_email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists institutes_slug_idx on public.institutes (slug);

comment on table public.institutes is 'Multi-tenant institute / coaching center';
