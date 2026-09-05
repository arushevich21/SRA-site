import { unstable_cache } from 'next/cache';
import { msToLaptime, mapSessionType } from '@sra/domain';
import type { AccSessionResult, AccSessionType } from '@sra/shared-types';
import { supabase } from '../supabase';
import { ingestAccRaceSessionInto } from './ingest-session';
import { eventInstant, hasEventTime } from '../event-time';

const SESSION_ORDER: Record<AccSessionType, number> = { Practice: 0, Qualify: 1, Race: 2 };

// Upserts one parsed session into acc_race_sessions, using the production
// singleton client. Thin wrapper over ingestAccRaceSessionInto (see
// ingest-session.ts for the actual upsert logic and why it's factored out
// this way) — kept so existing callers (the cron's hotlaps.ts, the admin
// upload action) don't need to change; scripts/backfill-acc-sessions.ts
// calls ingestAccRaceSessionInto directly with its own client and
// 'acc_race_sessions_staging' as the target instead.
export async function ingestAccRaceSession(session: AccSessionResult, sessionKey: string): Promise<void> {
  await ingestAccRaceSessionInto(supabase, 'acc_race_sessions', session, sessionKey);
}

export type AccRaceEventSummary = {
  eventKey: string;
  track: string;
  serverName: string | null;
  date: string; // earliest session date in the event
  championshipId: string | null;
  seasonId: string | null;
  sessionTypes: AccSessionType[]; // which of FP/Q/R exist, unordered
};

type RaceSessionRow = {
  event_key: string;
  track_key: string;
  server_name: string | null;
  session_date: string;
  session_type: AccSessionType;
  championship_id: string | null;
  season_id: string | null;
};

// Race events aren't a separate table — they're derived by grouping
// acc_race_sessions rows by event_key here. Simpler than keeping a second
// table in sync, and fine at the data volumes a league's race archive
// actually produces; revisit with a SQL view if this ever needs to paginate
// server-side.
async function fetchAccRaceEvents(): Promise<AccRaceEventSummary[]> {
  const { data, error } = await supabase
    .from('acc_race_sessions')
    .select('event_key, track_key, server_name, session_date, session_type, championship_id, season_id')
    .order('session_date', { ascending: false });
  if (error) throw error;

  const byEvent = new Map<string, AccRaceEventSummary>();
  for (const row of (data ?? []) as RaceSessionRow[]) {
    // Normalizes historical rows written before mapSessionType learned to
    // collapse sprint-weekend R1/R2/... codes to 'Race' — those rows still
    // have the raw code stored verbatim in session_type.
    const sessionType = mapSessionType(row.session_type);
    const existing = byEvent.get(row.event_key);
    if (!existing) {
      byEvent.set(row.event_key, {
        eventKey: row.event_key,
        track: row.track_key,
        serverName: row.server_name,
        date: row.session_date,
        championshipId: row.championship_id,
        seasonId: row.season_id,
        sessionTypes: [sessionType],
      });
    } else {
      if (row.session_date < existing.date) existing.date = row.session_date;
      if (!existing.sessionTypes.includes(sessionType)) existing.sessionTypes.push(sessionType);
    }
  }
  // Rows arrive newest-first, and a Map preserves first-insertion order, so
  // this is already newest-event-first.
  return [...byEvent.values()];
}

// Cached entry point — every round card on the calendar/championships pages
// (see matchAccRoundsToResultEventsFrom) calls this per page render, and it
// scans the full acc_race_sessions table with no filter. Uncached, that's one
// full-table read per request on some of the most-hit pages on the site;
// revalidate: 300 caps it to a Supabase read every 5 minutes regardless of
// traffic. Staleness just means a just-ingested result takes up to 5 minutes
// to link from a round card — the results page itself reads live.
export function getAccRaceEvents(): Promise<AccRaceEventSummary[]> {
  return unstable_cache(fetchAccRaceEvents, ['acc-race-events'], {
    revalidate: 300,
    tags: ['acc-race-events'],
  })();
}

type FullRaceSessionRow = RaceSessionRow & {
  session_file: string | null;
  meta_data: string | null;
  is_wet_session: boolean;
  best_lap_ms: number | null;
  results: AccSessionResult['results'];
};

export async function getAccRaceEventSessions(eventKey: string): Promise<AccSessionResult[]> {
  const { data, error } = await supabase
    .from('acc_race_sessions')
    .select(
      'session_type, track_key, server_name, session_date, session_file, meta_data, championship_id, season_id, is_wet_session, best_lap_ms, results',
    )
    .eq('event_key', eventKey);
  if (error) throw error;

  const sessions: AccSessionResult[] = ((data ?? []) as FullRaceSessionRow[]).map((row) => ({
    // See getAccRaceEvents's byEvent loop — same normalization for historical
    // R1/R2 rows.
    sessionType: mapSessionType(row.session_type),
    track: row.track_key,
    serverName: row.server_name,
    date: row.session_date,
    sessionFile: row.session_file,
    championshipId: row.championship_id,
    seasonId: row.season_id,
    metaDataRaw: row.meta_data,
    isWetSession: row.is_wet_session,
    bestLapMs: row.best_lap_ms,
    bestLap: msToLaptime(row.best_lap_ms),
    bestSplits: null,
    results: row.results,
  }));

  // Secondary sort by date: an event can have more than one session of the
  // same type (e.g. LIAW's Race 1/Race 2 format), and Supabase doesn't
  // guarantee row order without an explicit .order() — without this, which
  // race renders as "Race 1" vs "Race 2" in ResultsTabs would be arbitrary.
  return sessions.sort((a, b) => {
    const byType = SESSION_ORDER[a.sessionType] - SESSION_ORDER[b.sessionType];
    if (byType !== 0) return byType;
    return (a.date ?? '').localeCompare(b.date ?? '');
  });
}

// Loose comparison between a round's authored display name (round.track,
// e.g. "Mount Panorama") and a session's raw track_key (ACC's own internal
// slug, e.g. "mount_panorama" — see ingestAccRaceSessionInto, which stores
// session.track verbatim as both track_key and display_name). Normalizing
// (lowercase, strip non-alphanumerics) handles the common case where the
// slug is just the display name with underscores, but NOT every ACC
// circuit's internal codename — some are acronyms unrelated to the display
// name (Circuit of the Americas -> "cota"). TRACK_NAME_ALIASES is a
// deliberately incomplete patch for those, extended as a round actually
// needs it rather than front-loading ACC's full ~30-track list.
function normalizeTrackName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const TRACK_NAME_ALIASES: Readonly<Record<string, string>> = {
  circuitoftheamericas: 'cota',
};

function trackNamesLooselyMatch(roundTrackDisplayName: string, sessionTrackKey: string): boolean {
  const a = normalizeTrackName(roundTrackDisplayName);
  const b = normalizeTrackName(sessionTrackKey);
  if (a === b) return true;
  return TRACK_NAME_ALIASES[a] === b;
}

// A round only has a scheduled instant to match against, not a track+date
// pair Emperor is guaranteed to echo back exactly — races start late, admins
// adjust servers, etc. — so this is a window, not an exact-timestamp lookup.
const RESULT_MATCH_WINDOW_MS = 48 * 60 * 60 * 1000;

// Matches a championship's schedule rounds to their acc_race_sessions event,
// for linking a round card straight to its results. Two passes, in order of
// trust:
//
//   1. Same registered championship (event.championshipId ===
//      emperorChampionshipId). Reliable — but only when ACCSM actually ran
//      the round through its own Championship feature; a round run as a
//      Custom Race (confirmed live for LIAW week-of — see
//      ChampionshipStandingsBody's Emperor-standings-server fix for the same
//      distinction) never gets tagged this way. One championship_id can
//      cover a whole division's season, not just one round, so this pass
//      still needs the date pick below to land on the right event within it.
//   2. Track name (normalized) among ALL events, for exactly the Custom Race
//      case pass 1 misses.
//
// Either way, the closest event to the round's scheduled instant wins, and
// only within RESULT_MATCH_WINDOW_MS — a hit outside that window is more
// likely a coincidence (unrelated event on the same track) than a real
// match, so the round is left unlinked rather than risk pointing at the
// wrong race.
export async function matchAccRoundsToResultEvents(
  schedule: { round: number; track: string; date: string | null }[],
  emperorChampionshipId: string | null,
): Promise<Map<number, string>> {
  return matchAccRoundsToResultEventsFrom(await getAccRaceEvents(), schedule, emperorChampionshipId);
}

// Same matching, taking an already-fetched event list — for a page matching
// several championships' schedules at once (e.g. the championships listing),
// so it fetches acc_race_sessions' full event set once rather than once per
// championship.
export function matchAccRoundsToResultEventsFrom(
  events: AccRaceEventSummary[],
  schedule: { round: number; track: string; date: string | null }[],
  emperorChampionshipId: string | null,
): Map<number, string> {
  const matches = new Map<number, string>();

  for (const round of schedule) {
    if (!round.date) continue;
    // round.date is a naked ISO string meaning Eastern wall-clock time (see
    // event-time.ts) — plain new Date(round.date) would parse it as UTC and
    // throw the match off by whatever the EST/EDT offset is that day. A
    // date-only round (no time) has no real instant to compare against
    // acc_race_sessions' precise timestamps; midnight UTC of that calendar
    // day is a reasonable stand-in given RESULT_MATCH_WINDOW_MS's width.
    const roundInstant = hasEventTime(round.date)
      ? eventInstant(round.date)
      : Date.parse(`${round.date}T00:00:00Z`);
    if (Number.isNaN(roundInstant)) continue;

    const primary = emperorChampionshipId
      ? events.filter((e) => e.championshipId === emperorChampionshipId)
      : [];
    const candidates =
      primary.length > 0 ? primary : events.filter((e) => trackNamesLooselyMatch(round.track, e.track));

    let best: { eventKey: string; delta: number } | null = null;
    for (const event of candidates) {
      const delta = Math.abs(new Date(event.date).getTime() - roundInstant);
      if (delta > RESULT_MATCH_WINDOW_MS) continue;
      if (!best || delta < best.delta) best = { eventKey: event.eventKey, delta };
    }
    if (best) matches.set(round.round, best.eventKey);
  }

  return matches;
}
