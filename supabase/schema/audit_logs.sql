-- ExamGrid: operational audit logs

create table if not exists public.audit_logs (
  event_id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes (id) on delete cascade,
  actor_id text not null,
  actor_role text not null check (actor_role in ('admin', 'student', 'system')),
  action_type text not null,
  resource_type text not null,
  resource_id text not null,
  timestamp_utc timestamptz not null default now(),
  session_id text not null,
  source text not null,
  metadata jsonb not null default '{}'::jsonb,
  outcome text not null check (outcome in ('success', 'failure', 'blocked', 'warning'))
);

create index if not exists audit_logs_institute_time_idx
  on public.audit_logs (institute_id, timestamp_utc desc);
create index if not exists audit_logs_actor_idx
  on public.audit_logs (institute_id, actor_id);
create index if not exists audit_logs_action_idx
  on public.audit_logs (institute_id, action_type);
create index if not exists audit_logs_resource_idx
  on public.audit_logs (institute_id, resource_type, resource_id);

comment on table public.audit_logs is 'Operational audit trail for institute workflows and CBT integrity events';
