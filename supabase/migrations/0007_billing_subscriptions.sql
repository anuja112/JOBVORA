-- Stripe subscription state and AI application usage limits.
create table if not exists public.user_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'unlimited')),
  plan_name text not null default 'Free',
  plan_limit integer,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  subscription_status text not null default 'active',
  payment_status text not null default 'free',
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_apply_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  ai_apply_count integer not null default 0 check (ai_apply_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

create table if not exists public.billing_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_event_id text unique,
  plan_name text,
  amount_cents integer,
  currency text,
  payment_status text,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists daily_apply_usage_user_date_idx on public.daily_apply_usage(user_id, usage_date desc);
create index if not exists billing_history_user_created_idx on public.billing_history(user_id, created_at desc);

drop trigger if exists set_updated_at on public.user_subscriptions;
create trigger set_updated_at before update on public.user_subscriptions
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.daily_apply_usage;
create trigger set_updated_at before update on public.daily_apply_usage
  for each row execute function public.set_updated_at();

alter table public.user_subscriptions enable row level security;
alter table public.daily_apply_usage enable row level security;
alter table public.billing_history enable row level security;

create policy "user_subscriptions_select_own" on public.user_subscriptions
  for select using (auth.uid() = user_id);
create policy "daily_apply_usage_select_own" on public.daily_apply_usage
  for select using (auth.uid() = user_id);
create policy "billing_history_select_own" on public.billing_history
  for select using (auth.uid() = user_id);

-- Atomically reserve one AI application attempt. Calling this from the server
-- prevents concurrent browser tabs from exceeding a plan's daily allowance.
create or replace function public.check_and_increment_ai_apply_usage(p_user_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_limit integer;
  v_used integer;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'Cannot update usage for another user';
  end if;

  insert into public.user_subscriptions (user_id, plan, plan_name, plan_limit, subscription_status, payment_status)
  values (p_user_id, 'free', 'Free', 5, 'active', 'free')
  on conflict (user_id) do nothing;

  select plan_limit into v_limit
  from public.user_subscriptions
  where user_id = p_user_id;

  if v_limit is null then
    insert into public.daily_apply_usage (user_id, usage_date, ai_apply_count)
    values (p_user_id, current_date, 1)
    on conflict (user_id, usage_date)
    do update set ai_apply_count = public.daily_apply_usage.ai_apply_count + 1, updated_at = now()
    returning ai_apply_count into v_used;
    return jsonb_build_object('allowed', true, 'used', v_used, 'limit', null, 'remaining', null);
  end if;

  insert into public.daily_apply_usage (user_id, usage_date, ai_apply_count)
  values (p_user_id, current_date, 1)
  on conflict (user_id, usage_date)
  do update set ai_apply_count = public.daily_apply_usage.ai_apply_count + 1, updated_at = now()
  where public.daily_apply_usage.ai_apply_count < v_limit
  returning ai_apply_count into v_used;

  if v_used is null then
    select ai_apply_count into v_used from public.daily_apply_usage
    where user_id = p_user_id and usage_date = current_date;
    return jsonb_build_object('allowed', false, 'used', coalesce(v_used, v_limit), 'limit', v_limit, 'remaining', 0);
  end if;

  return jsonb_build_object('allowed', true, 'used', v_used, 'limit', v_limit, 'remaining', greatest(v_limit - v_used, 0));
end;
$$;

revoke all on function public.check_and_increment_ai_apply_usage(uuid) from public;
grant execute on function public.check_and_increment_ai_apply_usage(uuid) to authenticated;

-- Existing and future users always have a Free plan until Stripe upgrades it.
insert into public.user_subscriptions (user_id, plan, plan_name, plan_limit, subscription_status, payment_status)
select id, 'free', 'Free', 5, 'active', 'free' from auth.users
on conflict (user_id) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  insert into public.user_subscriptions (user_id, plan, plan_name, plan_limit, subscription_status, payment_status)
  values (new.id, 'free', 'Free', 5, 'active', 'free')
  on conflict (user_id) do nothing;
  return new;
end;
$$;
