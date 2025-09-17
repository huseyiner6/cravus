-- Cravus — Membership & Geo helpers (Sprint 1–2 hardening)

-- ========== VIEWS ==========
-- Eski tanımlar varsa güvenli biçimde düşür
drop view if exists public.checkins_view cascade;
drop view if exists public.user_membership_view cascade;

-- Kullanıcıya scope'lu üyelik görünümü
create view public.user_membership_view as
select u as user_id,
  coalesce(
    (select s.tier::text
       from public.subscriptions s
      where s.user_id = u and s.status in ('active','in_grace')
      limit 1),
    'free'
  ) as effective_tier
from (select auth.uid() as u) t;

grant select on public.user_membership_view to authenticated;

-- Check-in geçmişi (venue adı + indirim)
create view public.checkins_view as
select c.id, c.created_at, c.window_id,
       v.name as venue_name,
       w.discount_pct
  from public.checkins c
  join public.venues v on v.id = c.venue_id
  join public.deal_windows w on w.id = c.window_id
 where c.user_id = auth.uid();

grant select on public.checkins_view to authenticated;

-- ========== GEO RPCs (PostGIS) ==========
create or replace function public.is_within_venue(
  p_venue_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_meters integer default 75
) returns boolean
language sql
stable
security definer
as $$
  select st_dwithin(
    v.geo,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    p_meters
  )
    from public.venues v
   where v.id = p_venue_id;
$$;

grant execute on function public.is_within_venue(uuid,double precision,double precision,integer) to authenticated;

create or replace function public.distance_to_venue(
  p_venue_id uuid,
  p_lat double precision,
  p_lng double precision
) returns double precision
language sql
stable
security definer
as $$
  select st_distance(
    v.geo,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  )
    from public.venues v
   where v.id = p_venue_id;
$$;

grant execute on function public.distance_to_venue(uuid,double precision,double precision) to authenticated;

-- ========== Dev RPC: set_membership ==========
create or replace function public.set_membership(
  p_tier public.subscription_tier,
  p_platform text default 'ios'
) returns void
language plpgsql
security definer
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  insert into public.subscriptions (user_id, tier, platform, status, renews_at)
  values (uid, p_tier, p_platform, 'active', now() + interval '14 days')
  on conflict (user_id)
  do update set
    tier = excluded.tier,
    platform = excluded.platform,
    status = 'active',
    renews_at = now() + interval '14 days',
    updated_at = now();

  return;
end;
$$;

grant execute on function public.set_membership(public.subscription_tier,text) to authenticated;