-- Job search preferences on profiles (used to build Brave Search queries)

alter table public.profiles
  add column if not exists preferred_location text,
  add column if not exists target_role text,
  add column if not exists job_type_preference text;

comment on column public.profiles.preferred_location is 'Where the user wants to work, e.g. "Remote" or "San Francisco". Falls back to profiles.location if unset.';
comment on column public.profiles.target_role is 'The job title the user is searching for, e.g. "Frontend Developer". Falls back to profiles.headline if unset.';
comment on column public.profiles.job_type_preference is 'e.g. "Full-time", "Contract", "Internship", "Remote".';
