-- Task F (revised design, 2026-08-25): SRAQ1-5 server status. No inbound
-- HTTP endpoint on SRA-Bot — that would need auth, a Vercel->Linode hop,
-- and depends on the still-broken static.simracingalliance.com cert for
-- nothing this doesn't already avoid. Instead: SRA-Bot writes this table
-- from the loop that already reads each SRAQ results directory every 5
-- minutes (scripts/update_leaderboards.py's process_new_sessions — see that
-- repo for the write side), and cockpit reads it directly through the
-- service-role client it already uses everywhere else. No new auth, no
-- cert dependency, no inbound surface. If the bot's cron stops running,
-- this table just goes stale — updated_at/last_seen_at age out, which the
-- UI shows honestly ("last activity 40m ago") rather than a failed fetch
-- or a misleading online/offline dot.
--
-- This is a freshness/staleness signal, NOT a live query — there is no
-- "is SRAQ3 online right now" answer here, only "when did we last see it
-- produce a session." Naming and comments throughout keep that honest.
create table public.server_status (
  server_key    text primary key,       -- 'sraq1'..'sraq5'
  label         text not null,          -- 'SRAQ1'
  last_seen_at  timestamptz,            -- newest session file's date seen, most recent pass
  track_key     text,                   -- track of that newest session
  updated_at    timestamptz not null default now()
);

-- Public read: server names/labels/timestamps, no PII, meant to be shown on
-- the Hot Stint Qualifying / #Jagoff pages same as everything else there.
-- Writes are bot-only (its own service-role key, same as every other table
-- it maintains) — anon/authenticated get read-only.
alter table public.server_status enable row level security;

create policy server_status_select_all on public.server_status
  for select
  using (true);

revoke insert, update, delete, truncate on public.server_status from anon, authenticated;
