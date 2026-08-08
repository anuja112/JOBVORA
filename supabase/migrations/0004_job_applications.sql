-- Tracks AI-assisted application attempts independently from a discovered job.
create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  platform text not null default 'other',
  application_url text not null,
  status text not null default 'detecting_fields'
    check (status in ('detecting_fields', 'missing_profile_info', 'ready_to_apply', 'submitting', 'submitted', 'failed')),
  required_fields jsonb not null default '[]',
  missing_fields jsonb not null default '[]',
  field_mapping jsonb not null default '{}',
  browserbase_session_id text,
  submitted_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create index if not exists job_applications_user_status_idx
  on public.job_applications (user_id, status, updated_at desc);

drop trigger if exists set_updated_at on public.job_applications;
create trigger set_updated_at before update on public.job_applications
  for each row execute function public.set_updated_at();

alter table public.job_applications enable row level security;
drop policy if exists "job_applications_all_own" on public.job_applications;
create policy "job_applications_all_own" on public.job_applications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
