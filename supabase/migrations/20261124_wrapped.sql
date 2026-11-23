-- Migration: Season Wrapped storage. Run in Supabase SQL editor.
--
-- wrapped_cards   one precomputed card per driver per season (the snapshot —
--                 pages never recompute from live tables), plus the random
--                 token behind the public share link.
-- wrapped_seasons the league-wide recap for a season.
-- wrapped_views   who has seen / dismissed the launch prompt, per driver, so
--                 it doesn't come back on another device.
--
-- Access model: RLS ON and NO policies, and no grants for anon/authenticated.
-- Only the service role (site server code) reads or writes these tables. The
-- server decides what a request may see:
--   * /wrapped/<season>          the signed-in driver's own card only
--   * /wrapped/<season>/s/<tok>  whoever holds the token (public by link)
-- A card holds race results that are already public on the site; the token is
-- what keeps a driver's Wrapped from being enumerable.

begin;

create table if not exists wrapped_cards (
  season       text        not null,           -- registration key, e.g. 'acc-gt3-s19'
  steam_id     text        not null,           -- bare SteamID (drivers.steam_id format)
  driver_id    uuid        references drivers(id) on delete set null,
  share_token  text        not null unique,    -- 16 random bytes, base64url
  card         jsonb       not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (season, steam_id)
);
create index if not exists wrapped_cards_driver_idx on wrapped_cards (driver_id);

create table if not exists wrapped_seasons (
  season        text        primary key,
  summary       jsonb       not null,
  generated_at  timestamptz not null default now()
);

create table if not exists wrapped_views (
  driver_id  uuid        not null references drivers(id) on delete cascade,
  season     text        not null,
  seen_at    timestamptz not null default now(),
  primary key (driver_id, season)
);

alter table wrapped_cards   enable row level security;
alter table wrapped_seasons enable row level security;
alter table wrapped_views   enable row level security;

revoke all on wrapped_cards, wrapped_seasons, wrapped_views from anon, authenticated;

-- Verify: should return no rows.
select table_name, grantee, privilege_type
from   information_schema.role_table_grants
where  table_schema = 'public'
  and  table_name in ('wrapped_cards', 'wrapped_seasons', 'wrapped_views')
  and  grantee in ('anon', 'authenticated');

commit;

-- After running: .\scripts\dump-schema.ps1, then generate the snapshot from
-- /admin/wrapped.
