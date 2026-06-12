-- ExamGrid: server-authoritative CBT attempts, answers, and results.

create table if not exists public.cbt_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  test_id text not null,
  institute_id uuid not null references public.institutes (id) on delete cascade,
  student_id uuid references public.students (id) on delete set null,
  student_roll_number text not null,
  status text not null check (status in ('submitted', 'auto_submitted')),
  started_at timestamptz not null,
  submitted_at timestamptz not null,
  score numeric(10,2) not null default 0,
  accuracy numeric(6,3) not null default 0,
  total_questions integer not null check (total_questions >= 0),
  attempted_questions integer not null check (attempted_questions >= 0),
  integrity_score numeric(6,2) not null default 100,
  flagged boolean not null default false,
  answers jsonb not null default '{}'::jsonb,
  result_breakdown jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cbt_attempts_attempted_lte_total
    check (attempted_questions <= total_questions),
  constraint cbt_attempts_unique_student_test
    unique (institute_id, test_id, student_roll_number),
  constraint cbt_attempts_unique_session
    unique (session_id)
);

create table if not exists public.cbt_attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.cbt_attempts (id) on delete cascade,
  question_id text not null,
  selected_answer text,
  is_correct boolean not null default false,
  marks_awarded numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint cbt_attempt_answers_unique_question unique (attempt_id, question_id)
);

create table if not exists public.cbt_results (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.cbt_attempts (id) on delete cascade,
  score numeric(10,2) not null default 0,
  percentage numeric(6,3) not null default 0,
  accuracy numeric(6,3) not null default 0,
  rank_ready boolean not null default false,
  generated_at timestamptz not null default now(),
  constraint cbt_results_unique_attempt unique (attempt_id)
);

create index if not exists cbt_attempts_test_idx
  on public.cbt_attempts (institute_id, test_id);
create index if not exists cbt_attempts_student_idx
  on public.cbt_attempts (student_id);
create index if not exists cbt_attempts_roll_idx
  on public.cbt_attempts (institute_id, student_roll_number);
create index if not exists cbt_attempts_submitted_idx
  on public.cbt_attempts (institute_id, test_id, submitted_at desc);
create index if not exists cbt_attempt_answers_attempt_idx
  on public.cbt_attempt_answers (attempt_id);
create index if not exists cbt_results_attempt_idx
  on public.cbt_results (attempt_id);

alter table public.cbt_attempts enable row level security;
alter table public.cbt_attempt_answers enable row level security;
alter table public.cbt_results enable row level security;

drop policy if exists "dev_cbt_attempts_all" on public.cbt_attempts;
drop policy if exists "dev_cbt_attempt_answers_all" on public.cbt_attempt_answers;
drop policy if exists "dev_cbt_results_all" on public.cbt_results;

create policy "dev_cbt_attempts_all" on public.cbt_attempts
  for all using (true) with check (true);
create policy "dev_cbt_attempt_answers_all" on public.cbt_attempt_answers
  for all using (true) with check (true);
create policy "dev_cbt_results_all" on public.cbt_results
  for all using (true) with check (true);

create or replace function public.submit_cbt_attempt(
  p_session_id text,
  p_test_id text,
  p_institute_id uuid,
  p_student_roll_number text,
  p_status text,
  p_started_at timestamptz,
  p_submitted_at timestamptz,
  p_answers jsonb,
  p_result_breakdown jsonb,
  p_integrity_score numeric,
  p_flagged boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.cbt_attempts%rowtype;
  v_result public.cbt_results%rowtype;
  v_student_id uuid;
  v_total_questions integer;
  v_attempted integer;
  v_correct integer;
  v_score numeric(10,2);
  v_max_score numeric(10,2);
  v_accuracy numeric(6,3);
  v_percentage numeric(6,3);
begin
  if p_status not in ('submitted', 'auto_submitted') then
    raise exception 'Invalid CBT attempt status: %', p_status
      using errcode = '22023';
  end if;

  select id into v_student_id
  from public.students
  where institute_id = p_institute_id
    and lower(roll_number) = lower(trim(p_student_roll_number))
  limit 1;

  if v_student_id is null then
    raise exception 'Student roll number is not registered for this institute'
      using errcode = '23503';
  end if;

  select * into v_attempt
  from public.cbt_attempts
  where institute_id = p_institute_id
    and test_id = p_test_id
    and lower(student_roll_number) = lower(trim(p_student_roll_number))
  for update;

  if found then
    select * into v_result
    from public.cbt_results
    where attempt_id = v_attempt.id;

    return jsonb_build_object(
      'attempt', to_jsonb(v_attempt),
      'result', to_jsonb(v_result),
      'answers', coalesce((
        select jsonb_agg(to_jsonb(a) order by a.created_at)
        from public.cbt_attempt_answers a
        where a.attempt_id = v_attempt.id
      ), '[]'::jsonb),
      'idempotent', true
    );
  end if;

  v_total_questions := coalesce((p_result_breakdown->>'correct')::integer, 0)
    + coalesce((p_result_breakdown->>'incorrect')::integer, 0)
    + coalesce((p_result_breakdown->>'unattempted')::integer, 0);
  v_attempted := coalesce((p_result_breakdown->>'attempted')::integer, 0);
  v_correct := coalesce((p_result_breakdown->>'correct')::integer, 0);
  v_score := coalesce((p_result_breakdown->>'finalScore')::numeric, 0);
  v_max_score := coalesce((p_result_breakdown->>'maxScore')::numeric, 0);
  v_accuracy := case when v_attempted > 0 then round((v_correct::numeric / v_attempted::numeric) * 100, 3) else 0 end;
  v_percentage := case when v_max_score > 0 then round((v_score / v_max_score) * 100, 3) else 0 end;

  insert into public.cbt_attempts (
    session_id,
    test_id,
    institute_id,
    student_id,
    student_roll_number,
    status,
    started_at,
    submitted_at,
    score,
    accuracy,
    total_questions,
    attempted_questions,
    integrity_score,
    flagged,
    answers,
    result_breakdown
  ) values (
    p_session_id,
    p_test_id,
    p_institute_id,
    v_student_id,
    trim(p_student_roll_number),
    p_status,
    p_started_at,
    p_submitted_at,
    v_score,
    v_accuracy,
    v_total_questions,
    v_attempted,
    coalesce(p_integrity_score, 100),
    coalesce(p_flagged, false),
    coalesce(p_answers, '{}'::jsonb),
    p_result_breakdown
  )
  returning * into v_attempt;

  insert into public.cbt_attempt_answers (
    attempt_id,
    question_id,
    selected_answer,
    is_correct,
    marks_awarded
  )
  select
    v_attempt.id,
    item->>'questionId',
    nullif(item->>'selected', ''),
    coalesce((item->>'correct')::boolean, false),
    coalesce((item->>'marksAwarded')::numeric, 0)
  from jsonb_array_elements(coalesce(p_result_breakdown->'perQuestion', '[]'::jsonb)) item
  where item ? 'questionId';

  insert into public.cbt_results (
    attempt_id,
    score,
    percentage,
    accuracy,
    rank_ready
  ) values (
    v_attempt.id,
    v_score,
    v_percentage,
    v_accuracy,
    true
  )
  returning * into v_result;

  return jsonb_build_object(
    'attempt', to_jsonb(v_attempt),
    'result', to_jsonb(v_result),
    'answers', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.created_at)
      from public.cbt_attempt_answers a
      where a.attempt_id = v_attempt.id
    ), '[]'::jsonb),
    'idempotent', false
  );
end;
$$;

create or replace function public.get_cbt_submission(
  p_institute_id uuid,
  p_test_id text,
  p_student_roll_number text
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'attempt', to_jsonb(a),
    'result', to_jsonb(r),
    'answers', coalesce((
      select jsonb_agg(to_jsonb(ans) order by ans.created_at)
      from public.cbt_attempt_answers ans
      where ans.attempt_id = a.id
    ), '[]'::jsonb),
    'idempotent', true
  )
  from public.cbt_attempts a
  join public.cbt_results r on r.attempt_id = a.id
  where a.institute_id = p_institute_id
    and a.test_id = p_test_id
    and lower(a.student_roll_number) = lower(trim(p_student_roll_number))
  limit 1;
$$;

create or replace function public.list_cbt_submissions(
  p_institute_id uuid,
  p_test_id text
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'attempt', to_jsonb(a),
      'result', to_jsonb(r),
      'answers', coalesce((
        select jsonb_agg(to_jsonb(ans) order by ans.created_at)
        from public.cbt_attempt_answers ans
        where ans.attempt_id = a.id
      ), '[]'::jsonb),
      'idempotent', true
    )
    order by a.submitted_at
  ), '[]'::jsonb)
  from public.cbt_attempts a
  join public.cbt_results r on r.attempt_id = a.id
  where a.institute_id = p_institute_id
    and a.test_id = p_test_id;
$$;

comment on table public.cbt_attempts is 'Server-authoritative CBT submission attempts, one per student per test.';
comment on table public.cbt_attempt_answers is 'Normalized answer rows for each committed CBT attempt.';
comment on table public.cbt_results is 'Server-generated CBT result summary for each committed attempt.';
