create extension if not exists btree_gist;

alter table public.deal_windows
  add constraint deal_windows_time_ok
  check (ends_at > starts_at);

do $$
begin
  if exists (
    select 1 from pg_constraint
     where conname = 'no_overlap_per_venue'
       and conrelid = 'public.deal_windows'::regclass
  ) then
    alter table public.deal_windows drop constraint no_overlap_per_venue;
  end if;
end$$;

alter table public.deal_windows
  add constraint no_overlap_per_venue
  exclude using gist (
    venue_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) deferrable initially immediate;

create index if not exists deal_windows_active_idx
  on public.deal_windows (venue_id, starts_at, ends_at);

create index if not exists checkins_user_created_idx
  on public.checkins (user_id, created_at desc);
