-- Default institute for Phase 4B (no auth yet)
insert into public.institutes (id, name, slug, contact_email)
values (
  '00000000-0000-0000-0000-000000000001',
  'ExamGrid Default Institute',
  'default',
  null
)
on conflict (id) do nothing;
