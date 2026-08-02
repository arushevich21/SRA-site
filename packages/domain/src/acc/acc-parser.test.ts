import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAccSession, aggregateAccHotLapLeaderboard, computeAccEventKey } from './acc-parser.js';
import type { AccSessionResult, AccDriverResult } from '@sra/shared-types';

const FIXTURES = resolve(fileURLToPath(new URL('../../../../fixtures/acc-results', import.meta.url)));

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURES, name), 'utf-8'));
}

describe('parseAccSession', () => {
  describe('Free Practice', () => {
    const result = parseAccSession(loadFixture('260616_210110_FP.json'));

    it('parses session metadata', () => {
      expect(result.sessionType).toBe('Practice');
      expect(result.track).toBe('nurburgring');
      expect(result.date).toBe('2026-06-16T21:01:10Z');
      expect(result.sessionFile).toBe('260616_210110_FP');
      expect(result.isWetSession).toBe(false);
    });

    it('parses a metaData string with no season segment', () => {
      // "custom_race:<guid>" — one fewer segment than the championship form.
      expect(result.championshipId).toBe('b45ae983-f7a4-484f-8ef7-0c6123a99dd4');
      expect(result.seasonId).toBeNull();
    });

    it('has 17 cars already in session order', () => {
      expect(result.results).toHaveLength(17);
      expect(result.results[0].position).toBe(1);
      expect(result.results[16].position).toBe(17);
    });

    it('P1 (Dinarte) has a valid best lap', () => {
      const p1 = result.results[0];
      expect(p1.drivers[0].lastName).toBe('Dinarte');
      expect(p1.drivers[0].steamId).toBe('76561198095027668');
      expect(p1.bestLapMs).toBe(113347);
      expect(p1.bestLap).toMatch(/^\d+:\d{2}\.\d{3}$/);
      expect(p1.lapsCompleted).toBe(15);
      expect(p1.missingMandatoryPitstop).toBeNull(); // not applicable in FP
    });

    it('a driver with 0 laps has null best lap, not the int32 sentinel', () => {
      const last = result.results[16];
      expect(last.drivers[0].lastName).toBe('Allen');
      expect(last.lapsCompleted).toBe(0);
      expect(last.bestLapMs).toBeNull();
      expect(last.bestLap).toBeNull();
      expect(last.sectorsMs).toBeNull();
    });
  });

  describe('Qualify', () => {
    const result = parseAccSession(loadFixture('260616_213547_Q.json'));

    it('parses as Qualify session', () => {
      expect(result.sessionType).toBe('Qualify');
      expect(result.track).toBe('nurburgring');
    });

    it('parses a full "championship:<id>:<id>" metaData string', () => {
      expect(result.championshipId).toBe('d0d2757b-b4db-4176-859d-4048162df8a5');
      expect(result.seasonId).toBe('c3631f5c-c263-41e6-9e50-5fde74ff9797');
    });

    it('pole sitter is leaderBoardLines[0]', () => {
      const pole = result.results[0];
      expect(pole.position).toBe(1);
      expect(pole.drivers[0].lastName).toBe('Sir');
      expect(pole.drivers[0].steamId).toBe('76561199227704358');
      expect(pole.bestLapMs).toBe(113390);
      expect(pole.lapsCompleted).toBe(5);
    });

    it('last-place car still has a valid lap (unlike the FP no-time case)', () => {
      const last = result.results[19];
      expect(last.position).toBe(20);
      expect(last.drivers[0].lastName).toBe('Kewley');
      expect(last.bestLapMs).toBe(120785);
      expect(last.lapsCompleted).toBe(4);
    });
  });

  describe('Race', () => {
    const result = parseAccSession(loadFixture('260616_224355_R.json'));

    it('parses as Race session', () => {
      expect(result.sessionType).toBe('Race');
      expect(result.track).toBe('nurburgring');
    });

    it('winner is leaderBoardLines[0]', () => {
      const winner = result.results[0];
      expect(winner.position).toBe(1);
      expect(winner.carId).toBe(1010);
      expect(winner.carModel).toBe(8);
      expect(winner.carModelName).toBe('Bentley Continental GT3 2018');
      expect(winner.carGroup).toBe('GT3');
      expect(winner.cupCategory).toBe(0);
      expect(winner.cupCategoryName).toBe('Overall');
      expect(winner.raceNumber).toBe(747);
      expect(winner.drivers[0].lastName).toBe('Sir');
      expect(winner.currentDriverSteamId).toBe('76561199227704358');
      expect(winner.lapsCompleted).toBe(31);
      expect(winner.bestLapMs).toBe(113610);
      expect(winner.lastLapMs).toBe(115790);
      expect(winner.totalTimeMs).toBe(3610371);
      expect(winner.missingMandatoryPitstop).toBe(false);
    });

    it('last-place car flags a missed mandatory pitstop', () => {
      const last = result.results[19];
      expect(last.position).toBe(20);
      expect(last.drivers[0].lastName).toBe('Kewley');
      expect(last.lapsCompleted).toBe(3);
      expect(last.missingMandatoryPitstop).toBe(true);
    });

    it('parses session-wide best lap/sectors', () => {
      expect(result.bestLapMs).toBe(113610);
      expect(result.bestSplits).toEqual([54462, 42420, 16580]);
      expect(result.bestLap).toMatch(/^\d+:\d{2}\.\d{3}$/);
    });

    it('resolves cupCategory 3 (Silver) for a P17 entry', () => {
      const p17 = result.results[16];
      expect(p17.drivers[0].lastName).toBe('Platt');
      expect(p17.cupCategory).toBe(3);
      expect(p17.cupCategoryName).toBe('Silver');
    });

    it('resolves carModel 36 (Ford Mustang GT3) from the raw ID', () => {
      // carModel 36 appears in all three fixtures. It wasn't in Server Admin
      // Handbook IX.3 (the revision this table was built from stops at 35 for
      // GT3) until confirmed and added to ACC_CAR_MODEL_NAMES as Ford Mustang
      // GT3 — this exercises the real fixture data rather than a synthetic ID.
      const p4 = result.results[3];
      expect(p4.drivers[0].lastName).toBe('Hall');
      expect(p4.carModel).toBe(36);
      expect(p4.carModelName).toBe('Ford Mustang GT3');
    });
  });
});

describe('parseAccSession — steamId normalization', () => {
  function sessionWith(playerId: string | undefined): unknown {
    return {
      sessionType: 'R',
      trackName: 'nurburgring',
      sessionResult: {
        leaderBoardLines: [
          {
            car: {
              carId: 1,
              carModel: 8,
              drivers: [{ firstName: 'Test', lastName: 'Driver', playerId, shortName: 'TST' }],
            },
            currentDriverIndex: 0,
            missingMandatoryPitstop: 0,
            timing: { bestLap: 100000, lapCount: 1, lastLap: 100000, totalTime: 100000 },
          },
        ],
      },
    };
  }

  it('strips the leading "S" from playerId', () => {
    const result = parseAccSession(sessionWith('S76561198095027668'));
    expect(result.results[0].drivers[0].steamId).toBe('76561198095027668');
    expect(result.results[0].currentDriverSteamId).toBe('76561198095027668');
  });

  it('leaves a playerId with no "S" prefix unchanged', () => {
    const result = parseAccSession(sessionWith('76561198095027668'));
    expect(result.results[0].drivers[0].steamId).toBe('76561198095027668');
  });

  it('returns an empty string when playerId is missing', () => {
    const result = parseAccSession(sessionWith(undefined));
    expect(result.results[0].drivers[0].steamId).toBe('');
  });
});

describe('parseAccSession — no-time sentinel handling', () => {
  function sessionWithTiming(timing: Record<string, unknown>): unknown {
    return {
      sessionType: 'FP',
      trackName: 'nurburgring',
      sessionResult: {
        leaderBoardLines: [
          {
            car: { carId: 1, carModel: 8, drivers: [{ firstName: 'Test', lastName: 'Driver' }] },
            currentDriverIndex: 0,
            missingMandatoryPitstop: -1,
            timing: { lapCount: 0, ...timing },
          },
        ],
      },
    };
  }

  it('normalizes the int32-max sentinel to null for bestLap/lastLap', () => {
    const result = parseAccSession(
      sessionWithTiming({ bestLap: 2147483647, lastLap: 2147483647, totalTime: 2147483647 }),
    );
    const r = result.results[0];
    expect(r.bestLapMs).toBeNull();
    expect(r.bestLap).toBeNull();
    expect(r.lastLapMs).toBeNull();
    expect(r.totalTimeMs).toBeNull();
  });

  it('normalizes a sentinel-filled bestSplits array to null', () => {
    const result = parseAccSession(
      sessionWithTiming({ bestSplits: [2147483647, 2147483647, 2147483647] }),
    );
    expect(result.results[0].sectorsMs).toBeNull();
  });

  it('a real lap time is left untouched', () => {
    const result = parseAccSession(sessionWithTiming({ bestLap: 113610, bestSplits: [54480, 42420, 16580] }));
    const r = result.results[0];
    expect(r.bestLapMs).toBe(113610);
    expect(r.sectorsMs).toEqual([54480, 42420, 16580]);
  });

  it('missingMandatoryPitstop of -1 normalizes to null (not applicable)', () => {
    const result = parseAccSession(sessionWithTiming({}));
    expect(result.results[0].missingMandatoryPitstop).toBeNull();
  });
});

describe('aggregateAccHotLapLeaderboard', () => {
  function driverResult(r: Partial<AccDriverResult>): AccDriverResult {
    return {
      position: 1,
      carId: 1,
      carModel: 1,
      carModelName: 'Mercedes-AMG GT3',
      carGroup: 'GT3',
      cupCategory: 0,
      cupCategoryName: 'Overall',
      raceNumber: null,
      teamName: null,
      drivers: [{ firstName: 'Unknown', lastName: null, steamId: '', shortName: null }],
      currentDriverSteamId: '',
      lapsCompleted: 1,
      bestLapMs: null,
      bestLap: null,
      sectorsMs: null,
      lastLapMs: null,
      totalTimeMs: null,
      missingMandatoryPitstop: null,
      avgCleanLapMs: null,
      avgCleanLap: null,
      ...r,
    };
  }

  function session(results: Partial<AccDriverResult>[]): AccSessionResult {
    return {
      sessionType: 'Practice',
      track: 'nurburgring',
      serverName: null,
      date: null,
      sessionFile: null,
      championshipId: null,
      seasonId: null,
      metaDataRaw: null,
      isWetSession: false,
      bestLapMs: null,
      bestLap: null,
      bestSplits: null,
      results: results.map(driverResult),
    };
  }

  it('keeps a separate entry per car for the same driver within a class', () => {
    const sessions = [
      session([
        driverResult({ currentDriverSteamId: 'A', carModel: 1, carModelName: 'Mercedes-AMG GT3', bestLapMs: 115000, drivers: [{ firstName: 'Alice', lastName: null, steamId: 'A', shortName: null }] }),
        driverResult({ currentDriverSteamId: 'A', carModel: 5, carModelName: 'McLaren 650S GT3', bestLapMs: 113000, drivers: [{ firstName: 'Alice', lastName: null, steamId: 'A', shortName: null }] }),
      ]),
    ];
    const board = aggregateAccHotLapLeaderboard(sessions);
    expect(board).toHaveLength(2);
    expect(board.map((e) => e.carModel).sort()).toEqual([1, 5]);
  });

  it('does not let a faster lap in one car discard a slower lap already stored in another', () => {
    const sessions = [
      session([driverResult({ currentDriverSteamId: 'A', carModel: 1, bestLapMs: 115000, drivers: [{ firstName: 'Alice', lastName: null, steamId: 'A', shortName: null }] })]),
      session([driverResult({ currentDriverSteamId: 'A', carModel: 5, bestLapMs: 113000, drivers: [{ firstName: 'Alice', lastName: null, steamId: 'A', shortName: null }] })]),
    ];
    const board = aggregateAccHotLapLeaderboard(sessions);
    expect(board).toHaveLength(2);
    const mercedesEntry = board.find((e) => e.carModel === 1);
    expect(mercedesEntry?.bestLapMs).toBe(115000);
  });

  it('still ranks separately per carGroup', () => {
    const sessions = [
      session([
        driverResult({ currentDriverSteamId: 'A', carGroup: 'GT3', bestLapMs: 115000, drivers: [{ firstName: 'Alice', lastName: null, steamId: 'A', shortName: null }] }),
        driverResult({ currentDriverSteamId: 'B', carGroup: 'GT4', bestLapMs: 100000, drivers: [{ firstName: 'Bob', lastName: null, steamId: 'B', shortName: null }] }),
      ]),
    ];
    const board = aggregateAccHotLapLeaderboard(sessions);
    const gt3 = board.filter((e) => e.carGroup === 'GT3');
    const gt4 = board.filter((e) => e.carGroup === 'GT4');
    expect(gt3.map((e) => e.rank)).toEqual([1]);
    expect(gt4.map((e) => e.rank)).toEqual([1]);
  });

  it('ignores entries with no carGroup, no steamId, or null bestLapMs', () => {
    const sessions = [
      session([
        driverResult({ currentDriverSteamId: 'A', carGroup: null, bestLapMs: 100000 }),
        driverResult({ currentDriverSteamId: '', bestLapMs: 100000 }),
        driverResult({ currentDriverSteamId: 'B', bestLapMs: null }),
      ]),
    ];
    expect(aggregateAccHotLapLeaderboard(sessions)).toEqual([]);
  });

  it('returns empty array for no sessions', () => {
    expect(aggregateAccHotLapLeaderboard([])).toEqual([]);
  });

  it('keeps a wet-session best and a dry-session best in the same car as separate entries', () => {
    const sessions = [
      { ...session([driverResult({ currentDriverSteamId: 'A', carModel: 1, bestLapMs: 120000, drivers: [{ firstName: 'Alice', lastName: null, steamId: 'A', shortName: null }] })]), isWetSession: true },
      { ...session([driverResult({ currentDriverSteamId: 'A', carModel: 1, bestLapMs: 115000, drivers: [{ firstName: 'Alice', lastName: null, steamId: 'A', shortName: null }] })]), isWetSession: false },
    ];
    const board = aggregateAccHotLapLeaderboard(sessions);
    expect(board).toHaveLength(2);
    expect(board.map((e) => ({ isWetSession: e.isWetSession, bestLapMs: e.bestLapMs })).sort((a, b) => a.bestLapMs - b.bestLapMs)).toEqual([
      { isWetSession: false, bestLapMs: 115000 },
      { isWetSession: true, bestLapMs: 120000 },
    ]);
  });
});

describe('parseAccSession — average clean lap and metaDataRaw (260617 fixtures)', () => {
  it("computes avgCleanLapMs as the mean of a car's valid laps (FP winner)", () => {
    const fp = parseAccSession(loadFixture('260617_210032_FP.json'));
    const p1 = fp.results[0];
    expect(p1.carId).toBe(1005);
    // Car 1005's laps: 114995 (valid), 114337 (valid), 119580 (valid), 120812 (invalid, excluded)
    expect(p1.avgCleanLapMs).toBe(116304);
    expect(p1.avgCleanLap).toMatch(/^\d+:\d{2}\.\d{3}$/);
  });

  it('avgCleanLapMs is null for a car with no laps at all', () => {
    const fp = parseAccSession(loadFixture('260617_210032_FP.json'));
    const zeroLapCar = fp.results.find((r) => r.carId === 1022);
    expect(zeroLapCar?.lapsCompleted).toBe(0);
    expect(zeroLapCar?.avgCleanLapMs).toBeNull();
    expect(zeroLapCar?.avgCleanLap).toBeNull();
  });

  it('parses metaDataRaw verbatim for a custom race', () => {
    const fp = parseAccSession(loadFixture('260617_210032_FP.json'));
    expect(fp.metaDataRaw).toBe('custom_race:e8acb295-5255-46a2-8a82-9a214f940726');
  });

  it('parses metaDataRaw verbatim for a championship round', () => {
    const q = parseAccSession(loadFixture('260617_213527_Q.json'));
    expect(q.metaDataRaw).toBe(
      'championship:8e16c79b-ec15-4602-ba3a-a8ba8ae6f91f:9da5229f-ca43-4d16-971f-8a93ba39a9f3',
    );
  });

  it('computes avgCleanLapMs across a full 31-lap race, excluding invalid laps', () => {
    const r = parseAccSession(loadFixture('260617_224418_R.json'));
    const winner = r.results[0];
    expect(winner.carId).toBe(1006);
    expect(winner.lapsCompleted).toBe(31);
    // 29 of 31 laps valid (2 excluded: 121350, 171235); sum of the 29 valid laptimes is 3,340,769
    expect(winner.avgCleanLapMs).toBe(115199);
  });
});

describe('computeAccEventKey', () => {
  it('groups the Q and R fixtures into the same event (same metaData, track, day)', () => {
    const q = parseAccSession(loadFixture('260617_213527_Q.json'));
    const r = parseAccSession(loadFixture('260617_224418_R.json'));
    expect(computeAccEventKey(q)).toBe(computeAccEventKey(r));
  });

  it('does not group the FP fixture with Q/R — different metaData (custom_race vs championship)', () => {
    const fp = parseAccSession(loadFixture('260617_210032_FP.json'));
    const q = parseAccSession(loadFixture('260617_213527_Q.json'));
    expect(computeAccEventKey(fp)).not.toBe(computeAccEventKey(q));
  });

  it('treats the same metaData+track on a different day as a different event', () => {
    const q = parseAccSession(loadFixture('260617_213527_Q.json'));
    const differentDay = { ...q, date: '2026-07-01T21:35:27Z' };
    expect(computeAccEventKey(differentDay)).not.toBe(computeAccEventKey(q));
  });
});
