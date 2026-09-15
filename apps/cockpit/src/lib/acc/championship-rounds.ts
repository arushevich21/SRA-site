import 'server-only';
import { pairOrphanEvents, type RoundEvent, type RoundRaceResult } from '@sra/domain';
import type { AccDriverResult, EmperorChampionshipStandings } from '@sra/shared-types';
import { supabase } from '../supabase';
import { matchAccRoundsToResultEventsFrom, type AccRaceEventSummary } from './round-match';
import { getAccRaceEvents, getAccRaceEventSessions } from './race-results-store';

// The round columns for an Emperor championship's standings table: every
// event Emperor has scored, in schedule order, joined to the race sessions
// we ingested for it (finishing order, fastest lap).
//
// Two ways an event links to its sessions:
//
//   1. Championship-run rounds. Emperor's result metaData is
//      "championship:<championshipId>:<eventId>" and the parser stores
//      segment 2 as acc_race_sessions.season_id — the same uuid that keys
//      EmperorDriverStanding.eventPoints. (Confirmed live on LIAW: every
//      Bathurst race row's season_id is the Bathurst event's id.) Exact.
//
//   2. Custom Race rounds. A night run outside ACCSM's Championship feature
//      (confirmed for LIAW's first two nights) has "custom_race:<preset>"
//      metadata — no event id anywhere — but Emperor still holds its points
//      under an event id once the admins import it. Those orphans are paired
//      to the schedule's still-unmatched rounds by WHO SCORED: the event's
//      scorers should be the drivers classified in that round's race
//      (pairOrphanEvents). The round's sessions are found the way the round
//      cards find them — track + date over every ingested event.
//
// An orphan that pairs with nothing still gets a column (its points are
// real) — just no finish colour or fastest-lap mark, and a schedule-order
// fallback label.

type SessionRow = {
  event_key: string;
  session_type: string;
  track_key: string;
  server_name: string | null;
  session_date: string;
  championship_id: string | null;
  season_id: string | null;
  results: AccDriverResult[];
};

// Stored session_type is Emperor's raw label — "Race" from the parser, but
// "R1"/"R2" on a two-race night come through verbatim (see acc-parser's
// normalizeSessionType default branch, which only maps R\d for the typed
// field). Anything starting with R is a race.
const isRace = (t: string) => /^R(ace|\d+)$/i.test(t);

function prettyTrack(trackKey: string): string {
  return trackKey
    .split('_')
    .map((w) => (w.length <= 4 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

function toRaceResults(results: AccDriverResult[]): RoundRaceResult[] {
  return results.map((r) => ({
    position: r.position,
    bestLapMs: r.bestLapMs,
    lapsCompleted: r.lapsCompleted,
    driverSteamIds: r.drivers.map((d) => d.steamId),
  }));
}

// Every event id Emperor has scored, with who scored it — from the driver
// rows, the only place the payload lists events.
function scoredEvents(standings: EmperorChampionshipStandings): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const rows of Object.values(standings.driverStandings)) {
    for (const d of rows) {
      for (const eventId of Object.keys(d.eventPoints)) {
        const list = out.get(eventId);
        if (list) list.push(d.steamId);
        else out.set(eventId, [d.steamId]);
      }
    }
  }
  return out;
}

export async function getChampionshipRoundEvents(
  emperorChampionshipId: string,
  standings: EmperorChampionshipStandings,
  schedule: { round: number; track: string; date: string | null }[],
  matchWindowMs?: number,
): Promise<RoundEvent[]> {
  const scored = scoredEvents(standings);
  if (scored.size === 0) return [];

  // ── 1. Championship-tagged sessions, keyed by event id ────────────────
  const { data, error } = await supabase
    .from('acc_race_sessions')
    .select('event_key, session_type, track_key, server_name, session_date, championship_id, season_id, results')
    .eq('championship_id', emperorChampionshipId)
    .not('season_id', 'is', null)
    .order('session_date', { ascending: true });

  if (error) {
    console.error(`championship round events read failed for ${emperorChampionshipId}:`, error);
  }

  const rows = ((data ?? []) as SessionRow[]).filter((r) => isRace(r.session_type));

  type Group = { eventId: string; eventKeys: Set<string>; track: string; date: string; races: SessionRow[] };
  const byEvent = new Map<string, Group>();
  for (const r of rows) {
    const g = byEvent.get(r.season_id!);
    if (g) {
      g.races.push(r);
      g.eventKeys.add(r.event_key);
    } else {
      byEvent.set(r.season_id!, {
        eventId: r.season_id!,
        eventKeys: new Set([r.event_key]),
        track: r.track_key,
        date: r.session_date,
        races: [r],
      });
    }
  }

  // Round numbers from the schedule, via the same matcher the round cards
  // use, so "R3" here is the same R3 the calendar links to. Matching is on
  // event_key (a track+date bucket), so map matched keys back to event ids.
  const summaries: AccRaceEventSummary[] = rows.map((r) => ({
    eventKey: r.event_key,
    track: r.track_key,
    serverName: r.server_name,
    date: r.session_date,
    championshipId: r.championship_id,
    seasonId: r.season_id,
    sessionTypes: ['Race'],
  }));
  const roundByEventKey = new Map<string, number>();
  for (const [round, eventKey] of matchAccRoundsToResultEventsFrom(
    summaries,
    schedule,
    emperorChampionshipId,
    matchWindowMs,
  )) {
    roundByEventKey.set(eventKey, round);
  }
  const scheduleTrack = (round: number) => schedule.find((s) => s.round === round)?.track;

  const events: RoundEvent[] = [];
  const usedRounds = new Set<number>();
  for (const g of byEvent.values()) {
    if (!scored.has(g.eventId)) continue; // a session tagged to an event Emperor hasn't scored
    let round: number | undefined;
    for (const key of g.eventKeys) {
      round = roundByEventKey.get(key);
      if (round != null) break;
    }
    if (round != null) usedRounds.add(round);
    events.push({
      eventId: g.eventId,
      round: round ?? 0,
      track: (round != null && scheduleTrack(round)) || prettyTrack(g.track),
      races: g.races.map((race) => ({ results: toRaceResults(race.results) })),
    });
  }

  // ── 2. Orphans: scored by Emperor, no tagged session ──────────────────
  const orphanIds = [...scored.keys()].filter((id) => !byEvent.has(id));
  if (orphanIds.length > 0) {
    const openRounds = schedule.filter((s) => !usedRounds.has(s.round));
    // Track + date only (no championship id) — that's precisely the pass the
    // tagged lookup above can't do. Read through the cached all-events list
    // the round cards already use.
    const candidateKeys = matchAccRoundsToResultEventsFrom(
      await getAccRaceEvents(),
      openRounds,
      null,
      matchWindowMs,
    );
    const candidates = await Promise.all(
      [...candidateKeys].map(async ([round, eventKey]) => {
        const races = (await getAccRaceEventSessions(eventKey)).filter((s) => s.sessionType === 'Race');
        return {
          round,
          key: eventKey,
          classifiedSteamIds: races.flatMap((s) => s.results.flatMap((r) => r.drivers.map((d) => d.steamId))),
          races: races.map((s) => ({ results: toRaceResults(s.results) })),
        };
      }),
    );

    const pairs = pairOrphanEvents(
      orphanIds.map((eventId) => ({ eventId, scorerSteamIds: scored.get(eventId)! })),
      candidates,
    );

    for (const eventId of orphanIds) {
      const c = candidates.find((x) => x.key === pairs.get(eventId));
      if (c) {
        usedRounds.add(c.round);
        events.push({ eventId, round: c.round, track: scheduleTrack(c.round) ?? '', races: c.races });
      } else {
        events.push({ eventId, round: 0, track: '', races: [] });
      }
    }
  }

  // ── 3. Order + label anything still unnumbered ────────────────────────
  // Unnumbered events (no schedule match) take the lowest schedule rounds
  // nobody claimed, in the order we found them, so the strip still reads
  // R1…Rn without gaps or collisions.
  const spare = schedule.map((s) => s.round).filter((r) => !usedRounds.has(r)).sort((a, b) => a - b);
  let next = Math.max(0, ...schedule.map((s) => s.round), ...events.map((e) => e.round));
  for (const e of events) {
    if (e.round !== 0) continue;
    e.round = spare.shift() ?? ++next;
    if (!e.track) e.track = scheduleTrack(e.round) ?? `Round ${e.round}`;
  }
  return events.sort((a, b) => a.round - b.round);
}
