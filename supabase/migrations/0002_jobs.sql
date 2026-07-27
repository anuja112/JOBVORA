-- =========================================================================
-- Jobs table: normalized results fetched from Brave Search per platform
-- =========================================================================

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('greenhouse', 'lever', 'workable', 'wellfound')),
  title text not null,
  company text,
  company_logo text,
  location text,
  salary text,
  job_type text,
  experience_level text,
  description text,
  tags jsonb not null default '[]',
  match_score int not null default 0 check (match_score between 0 and 100),
  job_url text not null,
  source_url text,
  applied_status text not null default 'not_applied'
    check (applied_status in ('not_applied', 'applied', 'interviewing', 'rejected', 'offer')),
  saved_status boolean not null default false,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- Prevents the same job URL being duplicated for a user on repeated fetches;
  -- re-fetching the same listing updates the existing row instead (see upsert
  -- logic in app/actions/jobs.ts).
  unique (user_id, job_url)
);

comment on table public.jobs is 'Job listings fetched from Brave Search per platform, cached per user for 6 hours.';

create index if not exists jobs_user_platform_idx
  on public.jobs (user_id, platform, fetched_at desc);

create index if not exists jobs_user_saved_idx
  on public.jobs (user_id, saved_status, fetched_at desc);

-- jobs has no updated_at column or trigger by design (per the spec's field
-- list) — fetched_at is bumped explicitly whenever a job is re-fetched.

alter table public.jobs enable row level security;

drop policy if exists "jobs_all_own" on public.jobs;
create policy "jobs_all_own" on public.jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
