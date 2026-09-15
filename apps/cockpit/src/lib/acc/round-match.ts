import { eventInstant, hasEventTime } from '../event-time';
import type { AccSessionType } from '@sra/shared-types';

// Pure round <-> result-event matching, split out of race-results-store.ts so
// it can be unit-tested: that module imports the Supabase client, which is
// 'server-only' and unimportable from a plain test. Nothing here touches the
// network or the DB — it is arithmetic over an already-fetched event list.

// One acc_race_sessions event (a practice/qualify/race group at one track on
// one date). Declared here rather than in race-results-store so this module
// has no import back into it.
export type AccRaceEventSummary = {
  eventKey: string;
  track: string;
  serverName: string | null;
  date: string; // earliest session date in the event
  championshipId: string | null;
  seasonId: string | null;
  sessionTypes: AccSessionType[]; // which of FP/Q/R exist, unordered
};

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

// Same matching, taking an already-fetched event list — for a page matching
// several championships' schedules at once (e.g. the championships listing),
// so it fetches acc_race_sessions' full event set once rather than once per
// championship.
// Narrower window for a split-night series. D1/D3 race Tuesday and D2/D4 race
// Wednesday AT THE SAME TRACK, ~24h apart — both comfortably inside the 48h
// default, so the track+date fallback (pass 2) could pick the wrong division's
// race outright. 12h keeps each night's race matchable (races start late, get
// red-flagged, get rerun the same evening) while making a cross-night match
// arithmetically impossible.
export const SPLIT_NIGHT_MATCH_WINDOW_MS = 12 * 60 * 60 * 1000;

export function matchAccRoundsToResultEventsFrom(
  events: AccRaceEventSummary[],
  schedule: { round: number; track: string; date: string | null }[],
  // One id, or every id a multi-division series spans (accsmChampionshipIds).
  emperorChampionshipId: string | string[] | null,
  // Defaults to RESULT_MATCH_WINDOW_MS. Callers matching one division of a
  // split-night series pass SPLIT_NIGHT_MATCH_WINDOW_MS — see above.
  matchWindowMs: number = RESULT_MATCH_WINDOW_MS,
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

    // A multi-division series has no single championship id — pass 1 has to
    // consider every division's, or a round card would fall through to the
    // unreliable track+date pass purely because the series spans four
    // championships instead of one.
    const championshipIds = new Set(
      emperorChampionshipId == null
        ? []
        : Array.isArray(emperorChampionshipId)
          ? emperorChampionshipId
          : [emperorChampionshipId],
    );
    const primary =
      championshipIds.size > 0
        ? events.filter((e) => e.championshipId != null && championshipIds.has(e.championshipId))
        : [];
    const candidates =
      primary.length > 0 ? primary : events.filter((e) => trackNamesLooselyMatch(round.track, e.track));

    let best: { eventKey: string; delta: number } | null = null;
    for (const event of candidates) {
      const delta = Math.abs(new Date(event.date).getTime() - roundInstant);
      if (delta > matchWindowMs) continue;
      if (!best || delta < best.delta) best = { eventKey: event.eventKey, delta };
    }
    if (best) matches.set(round.round, best.eventKey);
  }

  return matches;
}
