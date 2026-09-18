-- Who is in each commentary voice channel right now, as SRA-Bot last saw it.
-- One row per booth channel; the bot replaces the whole roster on every
-- voice-state change and on startup. The stream overlays read it so the
-- lower-third and intermission scenes show whoever is actually on air,
-- with no names typed into a browser-source URL.
--
-- The site's division -> channel map lives in apps/cockpit/src/lib/stream/booths.ts.

create table public.stream_booth (
  channel_id text primary key,
  -- [{ "discord_id": "…", "joined_at": "<iso>" }], in join order.
  members    jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.stream_booth is
  'Live roster of each commentary voice channel, written by SRA-Bot. Read by /overlay/commentators and /overlay/intermission.';
comment on column public.stream_booth.channel_id is 'Discord voice channel id.';
comment on column public.stream_booth.members is
  'Current members in join order: [{ discord_id, joined_at }]. Bots excluded.';

-- Service role only: the bot writes, the cockpit reads server-side. No
-- anon or authenticated access.
alter table public.stream_booth enable row level security;
