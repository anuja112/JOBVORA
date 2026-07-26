-- =========================================================================
-- Resume upload + profile onboarding schema
-- =========================================================================

-- ---------------------------------------------------------------------
-- 1. profiles  (one row per auth user)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  headline text,
  email text,
  phone text,
  location text,
  summary text,
  skills text[] not null default '{}',
  links jsonb not null default '[]', -- [{ "label": "LinkedIn", "url": "https://..." }]
  active_resume_id uuid,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Extended profile data for each user, auto-populated from resume parsing and editable by the user.';

-- ---------------------------------------------------------------------
-- 2. resumes  (uploaded resume files + parse status)
-- ---------------------------------------------------------------------
create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text not null,
  file_size bigint not null,
  status text not null default 'uploaded'
    check (status in ('uploaded', 'processing', 'parsed', 'failed')),
  parse_error text,
  version int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.resumes is 'Metadata for resume files uploaded to Supabase Storage.';

alter table public.profiles
  add constraint profiles_active_resume_id_fkey
  foreign key (active_resume_id) references public.resumes (id) on delete set null;

-- ---------------------------------------------------------------------
-- 3. work_experiences
-- ---------------------------------------------------------------------
create table if not exists public.work_experiences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  resume_id uuid references public.resumes (id) on delete set null,
  company text not null,
  title text not null,
  location text,
  start_date text,
  end_date text,
  is_current boolean not null default false,
  description text,
  bullets text[] not null default '{}',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. educations
-- ---------------------------------------------------------------------
create table if not exists public.educations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  resume_id uuid references public.resumes (id) on delete set null,
  institution text not null,
  degree text,
  field_of_study text,
  start_date text,
  end_date text,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5. projects
-- ---------------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  resume_id uuid references public.resumes (id) on delete set null,
  name text not null,
  description text,
  tech_stack text[] not null default '{}',
  link text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. certifications
-- ---------------------------------------------------------------------
create table if not exists public.certifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  resume_id uuid references public.resumes (id) on delete set null,
  name text not null,
  issuer text,
  issue_date text,
  credential_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------
create index if not exists resumes_user_id_idx on public.resumes (user_id);
create index if not exists work_experiences_user_id_idx on public.work_experiences (user_id);
create index if not exists educations_user_id_idx on public.educations (user_id);
create index if not exists projects_user_id_idx on public.projects (user_id);
create index if not exists certifications_user_id_idx on public.certifications (user_id);

-- ---------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.resumes;
create trigger set_updated_at before update on public.resumes
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.work_experiences;
create trigger set_updated_at before update on public.work_experiences
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.educations;
create trigger set_updated_at before update on public.educations
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.projects;
create trigger set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.certifications;
create trigger set_updated_at before update on public.certifications
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Auto-create a blank profile row whenever a new auth user signs up
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for any existing auth users created before this migration
insert into public.profiles (id, email, full_name)
select u.id, u.email, u.raw_user_meta_data ->> 'full_name'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- =========================================================================
-- Row Level Security
-- =========================================================================
alter table public.profiles enable row level security;
alter table public.resumes enable row level security;
alter table public.work_experiences enable row level security;
alter table public.educations enable row level security;
alter table public.projects enable row level security;
alter table public.certifications enable row level security;

-- profiles: a user can only read/write their own row
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- resumes
drop policy if exists "resumes_all_own" on public.resumes;
create policy "resumes_all_own" on public.resumes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- work_experiences
drop policy if exists "work_experiences_all_own" on public.work_experiences;
create policy "work_experiences_all_own" on public.work_experiences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- educations
drop policy if exists "educations_all_own" on public.educations;
create policy "educations_all_own" on public.educations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- projects
drop policy if exists "projects_all_own" on public.projects;
create policy "projects_all_own" on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- certifications
drop policy if exists "certifications_all_own" on public.certifications;
create policy "certifications_all_own" on public.certifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================================================
-- Storage: private "resumes" bucket, one folder per user (`${user_id}/...`)
-- =========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes',
  'resumes',
  false,
  10485760, -- 10 MB
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "resumes_storage_select_own" on storage.objects;
create policy "resumes_storage_select_own" on storage.objects
  for select using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "resumes_storage_insert_own" on storage.objects;
create policy "resumes_storage_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "resumes_storage_update_own" on storage.objects;
create policy "resumes_storage_update_own" on storage.objects
  for update using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "resumes_storage_delete_own" on storage.objects;
create policy "resumes_storage_delete_own" on storage.objects
  for delete using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
