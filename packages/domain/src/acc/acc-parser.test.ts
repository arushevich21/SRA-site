import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAccSession } from './acc-parser.js';

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

    it('a carModel not in the handbook lookup resolves to a null name, keeping the raw ID', () => {
      // carModel 36 appears in all three fixtures but isn't in Server Admin
      // Handbook IX.3 (revision this table was built from stops at 35 for GT3) —
      // exercise the real "unknown ID" case rather than a synthetic one.
      const p4 = result.results[3];
      expect(p4.drivers[0].lastName).toBe('Hall');
      expect(p4.carModel).toBe(36);
      expect(p4.carModelName).toBeNull();
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
