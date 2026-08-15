-- Restores the driver-uniqueness invariant the July team_members design had
-- (UNIQUE(driver_id, championship_key, season)) and lost when the schema
-- split into registrations/registration_drivers. Denormalizes
-- championship_key + season onto registration_drivers so a plain UNIQUE
-- constraint can enforce "one active claim per driver per event" — a real
-- DB constraint, not a check-then-insert, so it's race-safe by construction
-- (two concurrent register_entry() calls claiming the same driver: the
-- second INSERT fails with a unique_violation, full stop, no window for
-- both to succeed).
--
-- PROPOSED — NOT RUN. Depends on 20260811b (registrations.status/
-- waitlist_position, register_entry()) and the S99 cleanup, both confirmed
-- done live before this was written.

alter table public.registration_drivers
  add column if not exists championship_key text,
  add column if not exists season text;

-- Backfill for any existing rows (none expected right now — registrations
-- is empty post-cleanup — but this makes the migration correct regardless
-- of when it actually runs relative to that).
update public.registration_drivers rd
set championship_key = r.championship_key,
    season = r.season
from public.registrations r
where rd.registration_id = r.id
  and (rd.championship_key is null or rd.season is null);

alter table public.registration_drivers
  alter column championship_key set not null,
  alter column season set not null;

-- Auto-derive from the parent registrations row rather than trusting the
-- caller to pass matching values — cheaper and more robust than a separate
-- "assert they match" check (one PK lookup, and DRIFT BECOMES STRUCTURALLY
-- IMPOSSIBLE instead of merely checked): register_entry() is the only
-- writer today, but this makes any future direct insert (a script, an admin
-- tool, a different RPC) safe by construction instead of relying on every
-- future caller remembering to pass the right values.
create or replace function public.registration_drivers_set_event_key()
returns trigger
language plpgsql
as $$
begin
  select championship_key, season
    into new.championship_key, new.season
  from public.registrations
  where id = new.registration_id;

  if new.championship_key is null then
    raise exception 'registration_drivers: no registrations row for registration_id %', new.registration_id;
  end if;

  return new;
end;
$$;

drop trigger if exists registration_drivers_set_event_key on public.registration_drivers;
create trigger registration_drivers_set_event_key
  before insert or update of registration_id on public.registration_drivers
  for each row execute function public.registration_drivers_set_event_key();

-- The actual invariant. A driver can hold at most one active claim
-- (confirmed OR waitlisted — see the migration-header rationale in
-- 20260811b: you can't be on two teams just because one is waitlisted) per
-- (championship, season). Withdrawal is a DELETE of this row (see
-- leaveTeam(), to be updated in the /register wiring step), not a status
-- flag — a soft-delete would leave the row in place and permanently block
-- re-registration, which is exactly the bug this constraint must not
-- reintroduce.
alter table public.registration_drivers
  add constraint registration_drivers_one_claim_per_event
  unique (driver_id, championship_key, season);

create index if not exists registration_drivers_championship_season_idx
  on public.registration_drivers (championship_key, season);
