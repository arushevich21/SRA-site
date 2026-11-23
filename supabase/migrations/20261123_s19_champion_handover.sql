-- Migration: hand the #1 champion badge from the Season 18 D1 champion to the
-- Season 19 D1 champion. Run in Supabase SQL editor.
--
-- #1 is not a stored number: it's derived from drivers.is_champion (see
-- 20260730_driver_schema_cleanup.sql). Each driver keeps their permanent
-- driver_number. But display_name is a stored string that bakes the #1 in
-- (computeDriverDisplayName in apps/cockpit/src/lib/driver-display-name.ts),
-- and Discord nicknames only resync on a profile_sync bot job — so all three
-- have to move together.
--
-- S19 D1 result (Emperor championship 66ec4e93-75b4-498c-bd66-8d66267af36c,
-- read 2026-11-23): Mr Sir 716 pts, 8/8 rounds, 102 clear of P2.
--
--   outgoing: Anton Rushevich  706608c0-dc8e-44d3-87f7-4377f19fd3db  #81
--   incoming: Mr Sir           4661a7f3-dc45-4edd-be65-a8a84e2fa0b2  #747
--
-- Expected row counts: UPDATE 2, INSERT 0 2 (fewer inserts only if a
-- profile_sync for that driver is already pending — the dedup index skips it,
-- which is fine). Anything else → ROLLBACK.

begin;

update drivers
set    is_champion  = (id = '4661a7f3-dc45-4edd-be65-a8a84e2fa0b2'),
       display_name = trim(concat_ws(' ', first_name, last_name)) || '┊' ||
                      case when id = '4661a7f3-dc45-4edd-be65-a8a84e2fa0b2'
                           then 1 else driver_number end
where  id in ('706608c0-dc8e-44d3-87f7-4377f19fd3db',
              '4661a7f3-dc45-4edd-be65-a8a84e2fa0b2');

-- Exactly one champion afterwards.
do $$
begin
  if (select count(*) from drivers where is_champion) <> 1 then
    raise exception 'expected exactly one is_champion row';
  end if;
end $$;

-- Push the new nicknames to Discord (SRA-Bot drains bot_jobs).
insert into bot_jobs (type, payload)
select 'profile_sync', jsonb_build_object('discord_id', discord_id::text)
from   drivers
where  id in ('706608c0-dc8e-44d3-87f7-4377f19fd3db',
              '4661a7f3-dc45-4edd-be65-a8a84e2fa0b2')
  and  discord_id is not null
on conflict do nothing;

select display_name, driver_number, is_champion
from   drivers
where  id in ('706608c0-dc8e-44d3-87f7-4377f19fd3db',
              '4661a7f3-dc45-4edd-be65-a8a84e2fa0b2');
-- Expect: "Anton Rushevich┊81" / 81 / false and "Mr Sir┊1" / 747 / true

-- commit;   -- run after checking the counts and the select above
-- rollback;
