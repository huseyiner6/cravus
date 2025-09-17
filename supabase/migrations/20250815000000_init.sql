
-- Cravus — Supabase Bootstrap (v0.1 Membership-only)
-- Run with: supabase db reset  (or add to migrations and push)

-- Extensions
create extension if not exists pgcrypto;
create extension if not exists postgis;

-- ===========================
-- AUTH PROFILES
-- ===========================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  dob date,
  is_21_plus boolean default false,
  photo_url text,
  free_checkins_remaining int not null default 3,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "profiles: read own" on public.profiles for select
  using (auth.uid() = id);
create policy "profiles: update own" on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===========================
-- SUBSCRIPTIONS (membership-only monetization)
-- ===========================
do $$ begin
  create type public.subscription_tier as enum ('free','regular','pro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_status as enum ('active','past_due','canceled','in_grace');
exception when duplicate_object then null; end $$;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tier public.subscription_tier not null default 'free',
  platform text check (platform in ('ios','android','web')),
  status public.subscription_status not null default 'active',
  renews_at timestamptz,
  receipt_ref text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id)
);

alter table public.subscriptions enable row level security;
create policy "subscriptions: read own" on public.subscriptions for select
  using (auth.uid() = user_id);

-- ===========================
-- VENUES & DEAL WINDOWS
-- ===========================
create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  geo geography(point, 4326) not null,
  cuisine text,
  rules jsonb,
  active boolean default true,
  created_at timestamptz default now()
);

create index if not exists venues_geo_idx on public.venues using gist(geo);

create table if not exists public.deal_windows (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  discount_pct int not null check (discount_pct between 5 and 60),
  dine_in_only boolean default true
);

alter table public.venues enable row level security;
alter table public.deal_windows enable row level security;

-- Public read (anon + authenticated) for discovery; writes are service-only
create policy "venues: public read" on public.venues for select using (true);
create policy "windows: public read" on public.deal_windows for select using (true);

-- ===========================
-- CHECK-INS
-- ===========================
do $$ begin
  create type public.checkin_status as enum ('started','redeemed','expired','canceled');
exception when duplicate_object then null; end $$;

create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  window_id uuid not null references public.deal_windows(id) on delete cascade,
  method text check (method in ('gps','qr')) not null,
  otp_code text not null,
  otp_expires_at timestamptz not null,
  redeemed_at timestamptz,
  status public.checkin_status not null default 'started',
  created_at timestamptz default now(),
  unique (user_id, window_id)
);

create index if not exists checkins_user_idx on public.checkins(user_id);
create index if not exists checkins_window_idx on public.checkins(window_id);

alter table public.checkins enable row level security;
-- Users can read their own check-ins; insert/update via RPC (edge function) only
create policy "checkins: read own" on public.checkins for select
  using (auth.uid() = user_id);

-- Decrement free quota when redeemed (if still on free tier)
create or replace function public.decrement_free_checkins()
returns trigger as $$
begin
  if exists (
    select 1 from public.subscriptions s
    where s.user_id = new.user_id and s.tier = 'free' and s.status = 'active'
  ) then
    update public.profiles p
      set free_checkins_remaining = greatest(p.free_checkins_remaining - 1, 0)
    where p.id = new.user_id;
  end if;
  return new;
end; $$ language plpgsql security definer;

drop trigger if exists trg_checkin_redeemed on public.checkins;
create trigger trg_checkin_redeemed
  after update of status on public.checkins
  for each row
  when (new.status = 'redeemed' and (old.status is distinct from 'redeemed'))
  execute function public.decrement_free_checkins();

-- RPC: can_checkin (membership gating; called by edge function)
create or replace function public.can_checkin(target_user uuid)
returns boolean language sql security definer as $$
  with sub as (
    select coalesce(
      (select tier::text from public.subscriptions where user_id = target_user limit 1),
      'free'
    ) as tier
  ), prof as (
    select free_checkins_remaining from public.profiles where id = target_user
  )
  select case
    when (select tier from sub) in ('regular','pro') then true
    when (select free_checkins_remaining from prof) > 0 then true
    else false
  end;
$$;

revoke all on all tables in schema public from anon, authenticated;
-- Re-grant read where needed
grant select on public.venues, public.deal_windows to anon, authenticated;
grant select on public.profiles, public.subscriptions, public.checkins to authenticated;
