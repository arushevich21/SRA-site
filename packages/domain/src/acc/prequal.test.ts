import { describe, it, expect } from 'vitest';
import { extractAccValidLaps, computePrequalStandings, type PrequalEntryInput, type PrequalLap } from './prequal.js';

// ── extractAccValidLaps ─────────────────────────────────────────────────────

type D = [playerId: string, first: string, last: string];

function line(carId: number, carModel: number, drivers: D[], currentDriverIndex = 0) {
  return {
    car: {
      carId,
      carModel,
      drivers: drivers.map(([playerId, firstName, lastName]) => ({ playerId, firstName, lastName })),
    },
    currentDriverIndex,
  };
}

function rawLap(carId: number, driverIndex: number, laptime: number, isValidForBest = true) {
  return { carId, driverIndex, isValidForBest, laptime };
}

function session(laps: unknown[], lines: unknown[], trackName = 'spa') {
  return { sessionType: 'Q', trackName, laps, sessionResult: { leaderBoardLines: lines } };
}

describe('extractAccValidLaps', () => {
  it('keeps only valid laps, attributed to the driver who drove them, with their index in laps[]', () => {
    const raw = session(
      [
        rawLap(1, 0, 138_000), // 0: A
        rawLap(1, 1, 139_000), // 1: B (shared car, second driver)
        rawLap(1, 0, 150_000, false), // 2: A, invalid -> dropped
        rawLap(2, 0, 141_000), // 3: C
      ],
      [line(1, 28, [['S1', 'Al', 'A'], ['S2', 'Bo', 'B']]), line(2, 61, [['S3', 'Cy', 'C']])],
    );
    expect(extractAccValidLaps(raw)).toEqual([
      { lapIndex: 0, steamId: 'S1', carModelId: 28, lapMs: 138_000 },
      { lapIndex: 1, steamId: 'S2', carModelId: 28, lapMs: 139_000 },
      { lapIndex: 3, steamId: 'S3', carModelId: 61, lapMs: 141_000 },
    ]);
  });

  it("drops laps with no time (0 or ACC's int32-max sentinel)", () => {
    const raw = session(
      [rawLap(1, 0, 0), rawLap(1, 0, 2_147_483_647), rawLap(1, 0, 140_000)],
      [line(1, 28, [['S1', 'Al', 'A']])],
    );
    expect(extractAccValidLaps(raw).map((l) => l.lapIndex)).toEqual([2]);
  });

  it('drops laps it cannot attribute (unknown car, no playerId)', () => {
    const raw = session([rawLap(9, 0, 140_000), rawLap(1, 0, 140_000)], [line(1, 28, [['', 'No', 'Id']])]);
    expect(extractAccValidLaps(raw)).toEqual([]);
  });

  it('returns [] for garbage input', () => {
    expect(extractAccValidLaps(null)).toEqual([]);
    expect(extractAccValidLaps('x')).toEqual([]);
  });
});

// ── computePrequalStandings ─────────────────────────────────────────────────

const NO_TIME = 180_000; // 3:00.000
const OPTS = { lapsCounted: 3, noTimeMs: NO_TIME, classOrder: ['GT3', 'CUP', 'GT4'] };

function laps(steamId: string, carModelId: number, ...times: number[]): PrequalLap[] {
  return times.map((lapMs) => ({ steamId, carModelId, lapMs }));
}

function entry(
  entryId: string,
  entryClass: string,
  carModelId: number,
  drivers: string[],
  teamName = entryId,
): PrequalEntryInput {
  return {
    entryId,
    teamName,
    entryClass,
    carModelId,
    drivers: drivers.map((steamId) => ({ steamId, name: steamId })),
  };
}

describe('computePrequalStandings', () => {
  it("averages a driver's 3 fastest laps", () => {
    const [row] = computePrequalStandings(
      [entry('e1', 'GT3', 32, ['S1'])],
      laps('S1', 32, 140_000, 138_000, 139_000, 137_000, 150_000),
      OPTS,
    );
    expect(row.drivers[0].bestLapsMs).toEqual([137_000, 138_000, 139_000]);
    expect(row.drivers[0].averageMs).toBe(138_000);
    expect(row.drivers[0].lapsSet).toBe(5);
    expect(row.teamAverageMs).toBe(138_000);
    expect(row.complete).toBe(true);
  });

  it('takes lapsSet from lapCounts when the caller passes only top laps', () => {
    const [row] = computePrequalStandings(
      [entry('e1', 'GT3', 32, ['S1'])],
      laps('S1', 32, 137_000, 138_000, 139_000),
      { ...OPTS, lapCounts: new Map([['S1:32', 42]]) },
    );
    expect(row.drivers[0].lapsSet).toBe(42);
    expect(row.drivers[0].averageMs).toBe(138_000);
  });

  it('only counts laps in the car the entry is registered with', () => {
    const [row] = computePrequalStandings(
      [entry('e1', 'GT3', 32, ['S1'])],
      [...laps('S1', 32, 140_000, 140_000, 140_000), ...laps('S1', 34, 130_000, 130_000, 130_000)],
      OPTS,
    );
    expect(row.drivers[0].averageMs).toBe(140_000);
    expect(row.drivers[0].lapsSet).toBe(3);
  });

  it('gives a driver with no laps the 3:00.000 base average, and it counts against the team', () => {
    const [row] = computePrequalStandings(
      [entry('e1', 'GT3', 32, ['S1', 'S2'])],
      laps('S1', 32, 140_000, 140_000, 140_000),
      OPTS,
    );
    expect(row.drivers[1].averageMs).toBe(NO_TIME);
    expect(row.drivers[1].bestLapsMs).toEqual([]);
    expect(row.teamAverageMs).toBe((140_000 + NO_TIME) / 2);
    expect(row.complete).toBe(false);
  });

  it('pads a driver short of 3 laps with 3:00.000 per missing lap', () => {
    const [row] = computePrequalStandings(
      [entry('e1', 'GT3', 32, ['S1'])],
      laps('S1', 32, 141_000),
      OPTS,
    );
    expect(row.drivers[0].averageMs).toBe((141_000 + NO_TIME + NO_TIME) / 3);
    expect(row.complete).toBe(false);
  });

  it("team time is the average of the drivers' averages", () => {
    const [row] = computePrequalStandings(
      [entry('e1', 'GT3', 32, ['S1', 'S2'])],
      [...laps('S1', 32, 138_000, 138_000, 138_000), ...laps('S2', 32, 140_000, 140_000, 140_000)],
      OPTS,
    );
    expect(row.teamAverageMs).toBe(139_000);
  });

  it('ignores laps by drivers who are not on the entry (e.g. withdrawn)', () => {
    const [row] = computePrequalStandings(
      [entry('e1', 'GT3', 32, ['S1'])],
      [...laps('S1', 32, 140_000, 140_000, 140_000), ...laps('S9', 32, 100_000, 100_000, 100_000)],
      OPTS,
    );
    expect(row.drivers).toHaveLength(1);
    expect(row.teamAverageMs).toBe(140_000);
  });

  it('ranks within class, and builds the grid class by class in classOrder', () => {
    const rows = computePrequalStandings(
      [
        entry('gt4-fast', 'GT4', 61, ['S1']),
        entry('gt3-slow', 'GT3', 32, ['S2']),
        entry('cup', 'CUP', 28, ['S3']),
        entry('gt3-fast', 'GT3', 32, ['S4']),
      ],
      [
        ...laps('S1', 61, 150_000, 150_000, 150_000),
        ...laps('S2', 32, 140_000, 140_000, 140_000),
        ...laps('S3', 28, 145_000, 145_000, 145_000),
        ...laps('S4', 32, 138_000, 138_000, 138_000),
      ],
      OPTS,
    );
    expect(rows.map((r) => [r.entryId, r.classPosition, r.gridPosition])).toEqual([
      ['gt3-fast', 1, 1],
      ['gt3-slow', 2, 2],
      ['cup', 1, 3],
      ['gt4-fast', 1, 4],
    ]);
  });

  it('puts classes not in classOrder after the known ones', () => {
    const rows = computePrequalStandings(
      [entry('odd', 'TCX', 27, ['S1']), entry('gt4', 'GT4', 61, ['S2'])],
      [],
      OPTS,
    );
    expect(rows.map((r) => r.entryId)).toEqual(['gt4', 'odd']);
  });

  it('breaks a team-time tie on the single fastest lap, then team name', () => {
    const rows = computePrequalStandings(
      [entry('b', 'GT3', 32, ['S1'], 'Bravo'), entry('a', 'GT3', 32, ['S2'], 'Alpha'), entry('c', 'GT3', 32, ['S3'], 'Charlie')],
      [
        ...laps('S1', 32, 139_000, 140_000, 141_000), // avg 140_000, best 139_000
        ...laps('S2', 32, 140_000, 140_000, 140_000), // avg 140_000, best 140_000
        ...laps('S3', 32, 139_000, 140_000, 141_000), // same as Bravo -> name
      ],
      OPTS,
    );
    expect(rows.map((r) => r.teamName)).toEqual(['Bravo', 'Charlie', 'Alpha']);
  });

  it('an entry nobody has driven yet still gets a grid slot, at 3:00.000', () => {
    const [row] = computePrequalStandings([entry('e1', 'GT3', 32, ['S1', 'S2'])], [], OPTS);
    expect(row.teamAverageMs).toBe(NO_TIME);
    expect(row.bestLapMs).toBeNull();
    expect(row.gridPosition).toBe(1);
  });
});
