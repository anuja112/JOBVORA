-- Stores user-confirmed answers to application-specific questions, such as
-- work authorization or sponsorship, without overloading the core profile.
alter table public.profiles
  add column if not exists custom_fields jsonb not null default '{}';

comment on column public.profiles.custom_fields is 'User-confirmed answers to application-specific form questions.';
