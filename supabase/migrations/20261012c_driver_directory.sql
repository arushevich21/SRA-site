-- About → Drivers & Stats: the searchable driver directory and the live
-- population numbers that replace the page's hardcoded counts.
--
-- Functions rather than PostgREST queries because the directory sorts on
-- columns from three sources (drivers, driver_race_stats, driver_ratings) that
-- PostgREST can't join (the rollups have no FK to drivers — they key on the
-- S-prefixed SteamID), and the overview needs GROUP BYs. Sorting and paging
-- happen here, never client-side. ~2.8k drivers, so no extra index: a scan
-- of the table is cheaper than maintaining one.
--
-- Read-only; service-role only (cockpit reads server-side). Safe to re-run.

create or replace function public.driver_directory(
  p_search   text    default null,
  p_sort     text    default 'wins',   -- wins | starts | podiums | rating | name | number
  p_division integer default null,
  p_limit    integer default 50,
  p_offset   integer default 0
)
returns table (
  id            uuid,
  display_name  text,
  driver_number integer,
  country       text,
  division_id   integer,
  tier          text,
  is_sralien    boolean,
  starts        bigint,
  wins          bigint,
  podiums       bigint,
  composite     numeric,
  total_count   bigint
)
language sql
stable
set search_path = ''
as $$
  with q as (
    -- Escape LIKE wildcards so a search for "_" or "%" is literal.
    select nullif(trim(replace(replace(replace(coalesce(p_search, ''), '\', '\\'), '%', '\%'), '_', '\_')), '') as term
  ),
  rows as (
    select d.id, d.display_name, d.driver_number, d.country, d.division_id, d.tier::text as tier,
           d.is_sralien, r.starts, r.wins, r.podiums, dr.composite
    from public.drivers d
    left join public.driver_race_stats r
      on r.player_id = 'S' || d.steam_id and r.series = 'GT3'
    left join public.driver_ratings dr
      on dr.player_id = 'S' || d.steam_id and dr.engine = 'v2-openskill'
    cross join q
    where (q.term is null
           -- the bare name: display_name carries a '┊<number>' suffix, which
           -- would make a search for "81" also hit #815, #810, …
           or split_part(d.display_name, '┊', 1) ilike '%' || q.term || '%'
           or d.driver_number::text = q.term)
      and (p_division is null or d.division_id = p_division)
  )
  select r.*, count(*) over () as total_count
  from rows r
  order by
    case when p_sort = 'name'    then lower(r.display_name) end asc,
    case when p_sort = 'number'  then r.driver_number end asc nulls last,
    case when p_sort = 'starts'  then r.starts end desc nulls last,
    case when p_sort = 'podiums' then r.podiums end desc nulls last,
    case when p_sort = 'rating'  then r.composite end desc nulls last,
    case when p_sort not in ('name', 'number', 'starts', 'podiums', 'rating') then r.wins end desc nulls last,
    r.starts desc nulls last,
    lower(r.display_name),
    r.id
  limit greatest(1, least(p_limit, 200))
  offset greatest(0, p_offset);
$$;

-- The page's headline numbers and breakdowns, live from drivers.
--   numbered     — drivers holding a driver number (the old page's "Active
--                  Drivers": 655 of 999 numbers = its 66% utilization)
--   with_results — drivers whose SteamID has GT3 Series results
--   in_division  — drivers assigned a division this season
create or replace function public.drivers_overview()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'numbered',     (select count(*) from public.drivers where driver_number is not null),
    'with_results', (select count(*) from public.drivers d
                     where exists (select 1 from public.driver_race_stats r
                                   where r.player_id = 'S' || d.steam_id and r.series = 'GT3')),
    'in_division',  (select count(*) from public.drivers where division_id is not null),
    'with_country', (select count(*) from public.drivers where country is not null),
    'countries',    coalesce((select jsonb_agg(jsonb_build_object('country', country, 'count', n) order by n desc, country)
                              from (select country, count(*) as n from public.drivers
                                    where country is not null group by country) c), '[]'::jsonb),
    'divisions',    coalesce((select jsonb_agg(jsonb_build_object('division', division_id, 'total', total,
                                                                  'gold', gold, 'silver', silver, 'sralien', sralien)
                                               order by division_id)
                              from (select division_id, count(*) as total,
                                           count(*) filter (where tier = 'gold')   as gold,
                                           count(*) filter (where tier = 'silver') as silver,
                                           count(*) filter (where is_sralien)      as sralien
                                    from public.drivers where division_id is not null
                                    group by division_id) v), '[]'::jsonb),
    'computed_at',  now()
  );
$$;

revoke execute on function public.driver_directory(text, text, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.drivers_overview() from public, anon, authenticated;
