-- Migration: the reigning D1 champion runs #1 everywhere — site, Discord nick,
-- ACC entry list (in-game car number) — with their own number reserved for
-- their return. Run in Supabase SQL editor. Requires 20261123b first.
--
-- Supersedes the badge-only design (20260730): #1 was derived from is_champion
-- at display time, so every reader that didn't know the rule (SRA-Bot's nick
-- sync, the entry list push, most site pages) showed the real number instead.
-- Storing 1 in driver_number makes every existing reader correct with no code
-- change; reserved_number holds the champion's own number until they lose it.
--
-- Handover from now on is one call (the trigger does the swap):
--   select public.set_champion('<new champion drivers.id>');
-- It also rebuilds both display names, and the driver_number change fires
-- trg_bump_registrations_on_driver_update → entrylist re-push. Queue a
-- profile_sync bot job for both drivers afterwards for the Discord nicks.

begin;

-- ── 0. Drop display_number ───────────────────────────────────────────────────
-- Added ad hoc from an earlier plan (generated is_champion ? 1 : driver_number).
-- With driver_number = 1 stored for the champion it duplicates driver_number,
-- and nothing reads it.
alter table drivers drop column if exists display_number;

-- ── 1. reserved_number: the champion's own number, held while they run #1 ────
alter table drivers add column if not exists reserved_number integer;

-- ── 2. Move the current champion onto #1 ─────────────────────────────────────
-- Expected: UPDATE 1 (Mr Sir, 747 → reserved). display_name is already "┊1".
update drivers
set    reserved_number = driver_number,
       driver_number   = 1
where  is_champion
  and  driver_number is distinct from 1;

-- ── 3. Rules ─────────────────────────────────────────────────────────────────
-- #1 belongs to the champion and only the champion; everyone else 2..999.
alter table drivers drop constraint if exists drivers_number_range;
alter table drivers
  add constraint drivers_number_range
  check (driver_number is null
         or driver_number between 2 and 999
         or (driver_number = 1 and is_champion));

alter table drivers drop constraint if exists drivers_champion_runs_one;
alter table drivers
  add constraint drivers_champion_runs_one
  check (not is_champion or driver_number = 1);

alter table drivers drop constraint if exists drivers_reserved_number_range;
alter table drivers
  add constraint drivers_reserved_number_range
  check (reserved_number is null
         or (is_champion and reserved_number between 2 and 999));

create unique index if not exists drivers_reserved_number_key
  on drivers (reserved_number) where reserved_number is not null;

-- At most one champion.
create unique index if not exists drivers_one_champion
  on drivers (is_champion) where is_champion;

-- ── 4. Nobody else can take a reserved number ────────────────────────────────
-- Unique constraints can't span two columns, so check it here. 23505 so the
-- profile form's existing "already taken" handling covers it.
create or replace function public.drivers_guard_reserved_number()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.driver_number is not null and exists (
       select 1 from drivers
       where  reserved_number = new.driver_number
         and  id <> new.id)
  then
    raise exception 'driver_number % is reserved for the reigning champion', new.driver_number
      using errcode = '23505';
  end if;
  return new;
end $$;

drop trigger if exists drivers_guard_reserved_number on drivers;
create trigger drivers_guard_reserved_number
  before insert or update of driver_number on drivers
  for each row execute function public.drivers_guard_reserved_number();

-- ── 5. The swap, whenever is_champion flips ──────────────────────────────────
-- Gaining the title: own number → reserved_number, driver_number → 1.
-- Losing it: reserved_number → driver_number. Either way rebuild display_name
-- the way computeDriverDisplayName (apps/cockpit/src/lib/driver-display-name.ts)
-- and the bot write it: "First Last┊N", no spaces around ┊.
create or replace function public.drivers_champion_number_swap()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_full text;
begin
  if new.is_champion then
    new.reserved_number := old.driver_number;
    new.driver_number   := 1;
  else
    new.driver_number   := old.reserved_number;
    new.reserved_number := null;
  end if;

  v_full := trim(concat_ws(' ', new.first_name, new.last_name));
  if v_full <> '' then
    new.display_name := v_full || coalesce('┊' || new.driver_number, '');
  end if;
  return new;
end $$;

drop trigger if exists drivers_champion_number_swap on drivers;
create trigger drivers_champion_number_swap
  before update of is_champion on drivers
  for each row
  when (old.is_champion is distinct from new.is_champion)
  execute function public.drivers_champion_number_swap();

-- ── 6. set_champion(): the handover, in the only order that works ────────────
-- The outgoing champion must drop #1 before the incoming one takes it
-- (driver_number is unique, checked row by row), so it's two statements.
create or replace function public.set_champion(p_driver_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from drivers where id = p_driver_id) then
    raise exception 'no driver %', p_driver_id;
  end if;
  update drivers set is_champion = false where is_champion and id <> p_driver_id;
  update drivers set is_champion = true  where id = p_driver_id and not is_champion;
end $$;

-- Functions are executable by PUBLIC by default; this one is admin-only.
revoke execute on function public.set_champion(uuid) from public, anon, authenticated;

-- ── Verify ───────────────────────────────────────────────────────────────────
select display_name, driver_number, reserved_number, is_champion
from   drivers
where  is_champion or reserved_number is not null;
-- Expect one row: Mr Sir┊1 | 1 | 747 | true

commit;

-- After running: .\scripts\dump-schema.ps1, and queue Mr Sir's nick resync:
--   insert into bot_jobs (type, payload)
--   select 'profile_sync', jsonb_build_object('discord_id', discord_id)
--   from drivers where is_champion and discord_id is not null
--   on conflict do nothing;
