// Endurance pre-qualifying — sets the starting grid for a one-off endurance
// race from laps driven on a dedicated pre-qualifying server in the weeks
// before it (first used: SRA Multiclass Enduro, Spa, 2026-12-05).
//
// The format (decided by the league, 2026-11-21):
//   * A driver's time is the average of their N (3) fastest valid laps, in the
//     car their entry is registered with. Laps in any other car don't count.
//   * Short of N laps, each missing lap counts as noTimeMs (3:00.000) — so a
//     driver with no laps at all averages exactly 3:00.000. A driver who
//     doesn't withdraw and doesn't drive drags their team down; that's the
//     point.
//   * An entry's time is the plain average of its drivers' averages.
//   * The grid is built class by class (classOrder), fastest first in each.
//
// Pure: callers decide which laps are in scope (server, track, window).

// ── raw API shapes — private ────────────────────────────────────────────────

type RawDriver = { playerId?: string };
type RawLine = { car?: { carId?: number; carModel?: number; drivers?: RawDriver[] }; currentDriverIndex?: number };
type RawLap = { carId?: number; driverIndex?: number; isValidForBest?: boolean; laptime?: number };

const NO_TIME_SENTINEL = 2_147_483_647; // ACC's int32-max "no lap"

export type AccValidLap = {
  lapIndex: number; // position in the session's flat laps[] — with the file, a stable key
  steamId: string; // S-prefixed playerId
  carModelId: number;
  lapMs: number;
};

// Every valid lap in an ACC result file, credited to car.drivers[driverIndex]
// (who actually drove it — same attribution as the lap ledger, so shared
// endurance cars split correctly). Unattributable laps are dropped.
export function extractAccValidLaps(raw: unknown): AccValidLap[] {
  if (!raw || typeof raw !== 'object') return [];
  const session = raw as { laps?: RawLap[]; sessionResult?: { leaderBoardLines?: RawLine[] } };

  const cars = new Map<number, { model: number; drivers: RawDriver[]; current: number }>();
  for (const l of session.sessionResult?.leaderBoardLines ?? []) {
    const car = l.car;
    if (car?.carId == null || car.carModel == null) continue;
    cars.set(car.carId, { model: car.carModel, drivers: car.drivers ?? [], current: l.currentDriverIndex ?? 0 });
  }

  const out: AccValidLap[] = [];
  (session.laps ?? []).forEach((lap, lapIndex) => {
    if (!lap.isValidForBest) return;
    const ms = lap.laptime;
    if (typeof ms !== 'number' || ms <= 0 || ms >= NO_TIME_SENTINEL) return;
    const car = lap.carId == null ? undefined : cars.get(lap.carId);
    if (!car) return;
    const idx = lap.driverIndex;
    const driver =
      idx != null && idx >= 0 && idx < car.drivers.length ? car.drivers[idx] : car.drivers[car.current];
    if (!driver?.playerId) return;
    out.push({ lapIndex, steamId: driver.playerId, carModelId: car.model, lapMs: ms });
  });
  return out;
}

// ── standings ───────────────────────────────────────────────────────────────

export type PrequalLap = { steamId: string; carModelId: number; lapMs: number };

export type PrequalEntryInput = {
  entryId: string;
  teamName: string;
  entryClass: string;
  carModelId: number;
  drivers: Array<{ steamId: string; name: string }>; // S-prefixed steamId
};

export type PrequalOptions = {
  lapsCounted: number;
  noTimeMs: number;
  classOrder: string[];
  // Total valid laps per `${steamId}:${carModelId}`, for callers that pass
  // only each driver's top laps (the DB returns just those). Absent → counted
  // from `laps`.
  lapCounts?: ReadonlyMap<string, number>;
};

export type PrequalDriverResult = {
  steamId: string;
  name: string;
  bestLapsMs: number[]; // up to lapsCounted, fastest first — real laps only
  lapsSet: number; // every valid lap in the registered car
  averageMs: number; // with missing laps padded at noTimeMs
};

export type PrequalStandingRow = {
  entryId: string;
  teamName: string;
  entryClass: string;
  carModelId: number;
  drivers: PrequalDriverResult[];
  teamAverageMs: number;
  bestLapMs: number | null; // fastest single lap on the entry — tiebreak
  complete: boolean; // every driver has lapsCounted real laps
  classPosition: number;
  gridPosition: number;
};

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function computePrequalStandings(
  entries: PrequalEntryInput[],
  laps: PrequalLap[],
  opts: PrequalOptions,
): PrequalStandingRow[] {
  const lapsByKey = new Map<string, number[]>();
  for (const l of laps) {
    const key = `${l.steamId}:${l.carModelId}`;
    const list = lapsByKey.get(key);
    if (list) list.push(l.lapMs);
    else lapsByKey.set(key, [l.lapMs]);
  }

  const rows = entries
    .filter((e) => e.drivers.length > 0)
    .map((e) => {
      const drivers: PrequalDriverResult[] = e.drivers.map((d) => {
        const mine = [...(lapsByKey.get(`${d.steamId}:${e.carModelId}`) ?? [])].sort((a, b) => a - b);
        const best = mine.slice(0, opts.lapsCounted);
        const padded = [...best, ...Array(opts.lapsCounted - best.length).fill(opts.noTimeMs)];
        const lapsSet = opts.lapCounts?.get(`${d.steamId}:${e.carModelId}`) ?? mine.length;
        return { steamId: d.steamId, name: d.name, bestLapsMs: best, lapsSet, averageMs: mean(padded) };
      });
      const allBest = drivers.flatMap((d) => d.bestLapsMs);
      return {
        entryId: e.entryId,
        teamName: e.teamName,
        entryClass: e.entryClass,
        carModelId: e.carModelId,
        drivers,
        teamAverageMs: mean(drivers.map((d) => d.averageMs)),
        bestLapMs: allBest.length > 0 ? Math.min(...allBest) : null,
        complete: drivers.every((d) => d.bestLapsMs.length >= opts.lapsCounted),
        classPosition: 0,
        gridPosition: 0,
      };
    });

  const classRank = (c: string) => {
    const i = opts.classOrder.indexOf(c);
    return i === -1 ? opts.classOrder.length : i;
  };
  rows.sort(
    (a, b) =>
      classRank(a.entryClass) - classRank(b.entryClass) ||
      a.entryClass.localeCompare(b.entryClass) ||
      a.teamAverageMs - b.teamAverageMs ||
      (a.bestLapMs ?? Infinity) - (b.bestLapMs ?? Infinity) ||
      a.teamName.localeCompare(b.teamName),
  );

  const perClass = new Map<string, number>();
  rows.forEach((r, i) => {
    const n = (perClass.get(r.entryClass) ?? 0) + 1;
    perClass.set(r.entryClass, n);
    r.classPosition = n;
    r.gridPosition = i + 1;
  });
  return rows;
}
