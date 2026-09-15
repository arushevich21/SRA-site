// Per-round breakdown of an Emperor championship table — pure arithmetic
// over two things the app layer already has: Emperor's standings (which
// carry per-event points and the drop round, see EmperorDriverStanding) and
// our own ingested race sessions (which carry finishing order and lap
// times). Nothing here re-scores anything: points and drops are Emperor's,
// verbatim; this only lines them up under round columns and decorates each
// cell with what the race result says.

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
  // them scored it.
  points: number | null;
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

/**
 * Round cells for every team in one class group. Points per event are the
 * sum of what each driver scored UNDER THAT TEAM (teamEventPoints), so a
 * driver who moved teams mid-season contributes each night to the team they
 * were on. The drop is the team row's own (Emperor drops the team's worst
 * combined night, which needn't match either driver's individual drop).
 */
export function buildTeamRounds(
  teams: { teamName: string; droppedEventIds: string[] }[],
  drivers: { teamEventPoints: Record<string, Record<string, number>> }[],
  events: RoundEvent[],
): Map<string, TeamRoundCell[]> {
  // teamName -> eventId -> points
  const totals = new Map<string, Map<string, number>>();
  for (const t of teams) totals.set(t.teamName, new Map());
  for (const d of drivers) {
    for (const [teamName, byEvent] of Object.entries(d.teamEventPoints)) {
      const team = totals.get(teamName);
      if (!team) continue; // a team Emperor doesn't rank in this group
      for (const [eventId, pts] of Object.entries(byEvent)) {
        team.set(eventId, (team.get(eventId) ?? 0) + pts);
      }
    }
  }

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
    const dropped = new Set(t.droppedEventIds);
    out.set(
      t.teamName,
      events.map((ev) => {
        const points = byEvent.has(ev.eventId) ? byEvent.get(ev.eventId)! : null;
        return {
          points,
          dropped: dropped.has(ev.eventId),
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
