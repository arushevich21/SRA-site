// Per-round breakdown of an Emperor championship table — pure arithmetic
// over two things the app layer already has: Emperor's standings (which
// carry per-event points and the drop round, see EmperorDriverStanding) and
// our own ingested race sessions (which carry finishing order and lap
// times). Nothing here re-scores anything: points and drops are Emperor's,
// verbatim; this only lines them up under round columns and decorates each
// cell with what the race result says. The one exception is the team
// championship's drop rule — see applyIndividualTeamDrops.

import type { EmperorChampionshipStandings } from '@sra/shared-types';

export type RoundRaceResult = {
  position: number;
  bestLapMs: number | null;
  lapsCompleted: number;
  // Bare (un-prefixed) SteamIDs of everyone who drove this car.
  driverSteamIds: string[];
};

// One championship event = one round column. `races` are the event's race
// sessions in running order; a two-race night (LIAW) has two.
export type RoundEvent = {
  eventId: string;
  round: number;
  track: string;
  races: { results: RoundRaceResult[] }[];
};

export type DriverRoundCell = {
  // Emperor's points for this event, or null when the driver has no entry
  // for it (didn't race / not yet scored).
  points: number | null;
  // Emperor excluded this event from the driver's total.
  dropped: boolean;
  // Finishing position in the event's FINAL race — the feature race on a
  // two-race night. null when no race result names this driver.
  finish: number | null;
  // Set the fastest lap in at least one of the event's races.
  fastestLap: boolean;
};

export type DriverRounds = {
  cells: DriverRoundCell[]; // parallel to the `events` passed in
  fastestLaps: number;
};

export type TeamRoundCell = {
  // Sum of the team's drivers' points for this event, or null when none of
  // them scored it. The night's full total, drops included.
  points: number | null;
  // The part of `points` that doesn't count: the points of each driver whose
  // own drop round this is (see applyIndividualTeamDrops). 0 when no driver
  // dropped it.
  droppedPoints: number;
  // Every point scored this event is dropped — all of the team's scorers
  // dropped it.
  dropped: boolean;
  // Rank of this points total among every team in the same group that
  // scored the event (competition ranking: ties share, next rank skips).
  // null when points is null.
  rank: number | null;
};

// Emperor's standings key drivers by "S"-prefixed SteamID; our ingested
// results use the bare form. Compare on the bare form.
function bareSteamId(id: string): string {
  return id.startsWith('S') ? id.slice(1) : id;
}

function fastestLapSteamIds(results: RoundRaceResult[]): Set<string> {
  let best: number | null = null;
  let owners: string[] = [];
  for (const r of results) {
    if (r.bestLapMs == null || r.bestLapMs <= 0 || r.lapsCompleted <= 0) continue;
    if (best == null || r.bestLapMs < best) {
      best = r.bestLapMs;
      owners = r.driverSteamIds;
    } else if (r.bestLapMs === best) {
      owners = [...owners, ...r.driverSteamIds];
    }
  }
  return new Set(owners);
}

export function buildDriverRounds(
  driver: { steamId: string; eventPoints: Record<string, number>; droppedEventIds: string[] },
  events: RoundEvent[],
): DriverRounds {
  const id = bareSteamId(driver.steamId);
  const dropped = new Set(driver.droppedEventIds);
  let fastestLaps = 0;

  const cells = events.map((ev): DriverRoundCell => {
    const lastRace = ev.races[ev.races.length - 1];
    const finish =
      lastRace?.results.find((r) => r.driverSteamIds.includes(id))?.position ?? null;
    const fastestLap = ev.races.some((race) => fastestLapSteamIds(race.results).has(id));
    if (fastestLap) fastestLaps += 1;
    return {
      points: ev.eventId in driver.eventPoints ? driver.eventPoints[ev.eventId] : null,
      dropped: dropped.has(ev.eventId),
      finish,
      fastestLap,
    };
  });

  return { cells, fastestLaps };
}

type TeamDriver = {
  teamEventPoints: Record<string, Record<string, number>>;
  droppedEventIds: string[];
};

// teamName -> eventId -> { total scored, part of it dropped }, from what each
// driver scored UNDER THAT TEAM (teamEventPoints) — a driver who moved teams
// mid-season contributes each night to the team they were on. A driver's
// points for an event count as dropped when that event is one of the
// driver's OWN drop rounds.
type TeamEventTotal = {
  points: number;
  dropped: number;
  // How many of the team's drivers scored the event, and how many of those
  // dropped it — equal means none of the night counts.
  scorers: number;
  droppers: number;
};

function teamEventTotals(
  teamNames: Iterable<string>,
  drivers: TeamDriver[],
): Map<string, Map<string, TeamEventTotal>> {
  const totals = new Map<string, Map<string, TeamEventTotal>>();
  for (const name of teamNames) totals.set(name, new Map());
  for (const d of drivers) {
    const driverDrops = new Set(d.droppedEventIds);
    for (const [teamName, byEvent] of Object.entries(d.teamEventPoints)) {
      const team = totals.get(teamName);
      if (!team) continue; // a team Emperor doesn't rank in this group
      for (const [eventId, pts] of Object.entries(byEvent)) {
        const cell = team.get(eventId) ?? { points: 0, dropped: 0, scorers: 0, droppers: 0 };
        cell.points += pts;
        cell.scorers += 1;
        if (driverDrops.has(eventId)) {
          cell.dropped += pts;
          cell.droppers += 1;
        }
        team.set(eventId, cell);
      }
    }
  }
  return totals;
}

/**
 * Re-scores the team championship with SRA's drop rule: a team's total is
 * the sum of its drivers' points with EACH DRIVER'S OWN drop round(s)
 * removed — not, as Emperor computes it, the team's worst combined night
 * removed.
 *
 *   Driver 1: 35 37 69 100 50 88  (drops R1's 35)
 *   Driver 2: 80 79 64   0 55 25  (drops R4's 0)
 *   SRA:      682 - 35 - 0 = 647
 *   Emperor:  682 - R4's combined 100 = 582
 *
 * The driver drops are Emperor's own (droppedEventIds), so the driver table
 * and the team table agree on which rounds each driver dropped. Teams are
 * re-ranked on the new totals; a stable sort keeps Emperor's order between
 * tied teams. A team's PointsPenalty is still deducted. The team rows'
 * droppedEventIds are cleared — under this rule a drop belongs to a driver,
 * not a team (see TeamRoundCell.droppedPoints for how it's shown).
 *
 * A team none of whose drivers carries per-team event points keeps
 * Emperor's figure rather than dropping to 0 — there's nothing to re-score
 * it from.
 */
export function applyIndividualTeamDrops(standings: EmperorChampionshipStandings): EmperorChampionshipStandings {
  const drivers = Object.values(standings.driverStandings).flat();
  const allTeams = Object.values(standings.teamStandings).flat().map((t) => t.teamName);
  const totals = teamEventTotals(allTeams, drivers);

  const teamStandings: EmperorChampionshipStandings['teamStandings'] = {};
  for (const [className, teams] of Object.entries(standings.teamStandings)) {
    teamStandings[className] = teams
      .map((t) => {
        const byEvent = [...(totals.get(t.teamName)?.values() ?? [])];
        if (byEvent.length === 0) return t;
        const counted = byEvent.reduce((sum, e) => sum + e.points - e.dropped, 0);
        return { ...t, points: counted - t.pointsPenalty, droppedEventIds: [] };
      })
      .sort((a, b) => b.points - a.points)
      .map((t, i) => ({ ...t, position: i + 1 }));
  }
  return { ...standings, teamStandings };
}

/**
 * Round cells for every team in one class group: each night's combined
 * points, with the part that doesn't count (drivers' own drop rounds — see
 * applyIndividualTeamDrops) carried alongside.
 */
export function buildTeamRounds(
  teams: { teamName: string }[],
  drivers: TeamDriver[],
  events: RoundEvent[],
): Map<string, TeamRoundCell[]> {
  const cellTotals = teamEventTotals(
    teams.map((t) => t.teamName),
    drivers,
  );
  // teamName -> eventId -> points
  const totals = new Map(
    [...cellTotals].map(([name, byEvent]) => [
      name,
      new Map([...byEvent].map(([ev, c]) => [ev, c.points])),
    ]),
  );

  // Rank per event, competition style: sort desc, ties share the rank of
  // their first member.
  const rankByEvent = new Map<string, Map<string, number>>();
  for (const ev of events) {
    const scored = [...totals.entries()]
      .filter(([, byEvent]) => byEvent.has(ev.eventId))
      .map(([teamName, byEvent]) => ({ teamName, points: byEvent.get(ev.eventId)! }))
      .sort((a, b) => b.points - a.points);
    const ranks = new Map<string, number>();
    scored.forEach((s, i) => {
      const rank = i > 0 && scored[i - 1].points === s.points ? ranks.get(scored[i - 1].teamName)! : i + 1;
      ranks.set(s.teamName, rank);
    });
    rankByEvent.set(ev.eventId, ranks);
  }

  const out = new Map<string, TeamRoundCell[]>();
  for (const t of teams) {
    const byEvent = totals.get(t.teamName)!;
    const cells = cellTotals.get(t.teamName)!;
    out.set(
      t.teamName,
      events.map((ev) => {
        const points = byEvent.has(ev.eventId) ? byEvent.get(ev.eventId)! : null;
        const cell = cells.get(ev.eventId);
        return {
          points,
          droppedPoints: cell?.dropped ?? 0,
          // Fully dropped: every driver who scored this event for the team
          // dropped it, so none of the night counts.
          dropped: cell != null && cell.droppers === cell.scorers,
          rank: points == null ? null : (rankByEvent.get(ev.eventId)?.get(t.teamName) ?? null),
        };
      }),
    );
  }
  return out;
}

/**
 * Pairs championship events that have NO ingested session link (a round run
 * as an ACCSM Custom Race carries no event id in its result metadata) with
 * candidate rounds by who scored: an event's scorers should be the drivers
 * classified in that round's race. Each orphan takes the candidate whose
 * result roster overlaps its scorers most; a candidate is used at most once.
 * Greedy, best overlap first, so the clearest pairing is locked in before an
 * ambiguous one can steal it. An orphan with zero overlap anywhere is left
 * unpaired rather than guessed.
 */
export function pairOrphanEvents(
  orphans: { eventId: string; scorerSteamIds: string[] }[],
  candidates: { key: string; classifiedSteamIds: string[] }[],
): Map<string, string> {
  const scored: { eventId: string; key: string; overlap: number }[] = [];
  for (const o of orphans) {
    const scorers = new Set(o.scorerSteamIds.map(bareSteamId));
    for (const c of candidates) {
      const overlap = c.classifiedSteamIds.reduce((n, id) => n + (scorers.has(bareSteamId(id)) ? 1 : 0), 0);
      if (overlap > 0) scored.push({ eventId: o.eventId, key: c.key, overlap });
    }
  }
  scored.sort((a, b) => b.overlap - a.overlap);

  const out = new Map<string, string>();
  const usedKeys = new Set<string>();
  for (const s of scored) {
    if (out.has(s.eventId) || usedKeys.has(s.key)) continue;
    out.set(s.eventId, s.key);
    usedKeys.add(s.key);
  }
  return out;
}
