import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAcEvoSession, isValidLap, aggregateHotLapLeaderboard } from './ac-evo-parser.js';
import type { AcEvoSessionResult } from '@sra/shared-types';

const FIXTURES = resolve(fileURLToPath(new URL('../../../../fixtures/ac-evo-results', import.meta.url)));

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURES, name), 'utf-8'));
}

describe('parseAcEvoSession', () => {
  describe('Race', () => {
    const result = parseAcEvoSession(loadFixture('results_20260629_012505_race.json'));

    it('parses session metadata', () => {
      expect(result.sessionType).toBe('Race');
      expect(result.track).toBe('Road Atlanta');
      expect(result.trackLayout).toBe('GP');
      expect(result.isCompleted).toBe(true);
      expect(result.serverStartTime).toBe('2026-06-29T01:01:10.1198532Z');
    });

    it('has 2 drivers in finishing order', () => {
      expect(result.results).toHaveLength(2);
      expect(result.results[0].position).toBe(1);
      expect(result.results[1].position).toBe(2);
    });

    it('Cujo finishes P1 with 6 laps', () => {
      const cujo = result.results[0];
      // real name (first + last) preferred over nickname "Cujo" — matches what
      // Emperor's own leaderboard/standings UI displays.
      expect(cujo.driverName).toBe('Curtis Lee');
      expect(cujo.steamId).toBe('76561198035723322');
      expect(cujo.lapsCompleted).toBe(6);
      expect(cujo.noLaps).toBe(false);
      expect(cujo.totalTimeMs).toBe(603197);
      expect(cujo.carModel).toBe('Mazda MX-5 ND Cup');
      expect(cujo.bestLapMs).toBeGreaterThan(0);
      expect(cujo.bestLap).toMatch(/^\d+:\d{2}\.\d{3}$/);
    });

    it('Sean finishes P2 with 2 laps', () => {
      const sean = result.results[1];
      expect(sean.driverName).toBe('Sean Paul');
      expect(sean.steamId).toBe('76561197960529268');
      expect(sean.lapsCompleted).toBe(2);
      expect(sean.totalTimeMs).toBe(225806);
      expect(sean.carModel).toBe('Mazda MX-5 ND Cup');
    });
  });

  describe('Qualify', () => {
    const result = parseAcEvoSession(loadFixture('results_20260629_011316_qualify.json'));

    it('parses as Qualify session', () => {
      expect(result.sessionType).toBe('Qualify');
      expect(result.track).toBe('Road Atlanta');
    });

    it('Cujo has a valid qualifying time', () => {
      const cujo = result.results[0];
      expect(cujo.driverName).toBe('Curtis Lee');
      expect(cujo.qualifyingBestMs).toBe(97497);
      expect(cujo.setValidTime).toBe(true);
      expect(cujo.lapsCompleted).toBe(1);
      expect(cujo.noLaps).toBe(false);
    });

    it('Sean has no valid qualifying time', () => {
      const sean = result.results[1];
      expect(sean.driverName).toBe('Sean Paul');
      expect(sean.qualifyingBestMs).toBeNull();
      expect(sean.setValidTime).toBe(false);
      expect(sean.lapsCompleted).toBe(0);
      expect(sean.noLaps).toBe(true);
    });
  });

  describe('Practice', () => {
    const result = parseAcEvoSession(loadFixture('results_20260629_010736_practice.json'));

    it('parses as Practice session', () => {
      expect(result.sessionType).toBe('Practice');
      expect(result.track).toBe('Road Atlanta');
    });

    it('both drivers have 0 laps', () => {
      expect(result.results).toHaveLength(2);
      for (const driver of result.results) {
        expect(driver.lapsCompleted).toBe(0);
        expect(driver.noLaps).toBe(true);
        expect(driver.bestLapMs).toBeNull();
      }
    });
  });

  describe('driverName precedence', () => {
    const guid = { a: '1', b: '1' };

    function sessionWith(driver: Record<string, unknown>) {
      return {
        session_type: 'Practice',
        drivers: [{ guid, ...driver }],
        laps: [],
        cars: [],
        car_standings: [],
        driver_standings: [guid],
        time_standings: [0],
      };
    }

    it('prefers first + last name over nickname (matches Emperor\'s own UI)', () => {
      const result = parseAcEvoSession(
        sessionWith({ first_name: 'El ', last_name: 'Arct', nickname: 'AAA' }),
      );
      expect(result.results[0].driverName).toBe('El Arct');
    });

    it('trims stray internal whitespace from first/last name before joining', () => {
      const result = parseAcEvoSession(
        sessionWith({ first_name: ' Donovan ', last_name: ' Colton ', nickname: 'Sprugging' }),
      );
      expect(result.results[0].driverName).toBe('Donovan Colton');
    });

    it('falls back to nickname when no real name is on file', () => {
      const result = parseAcEvoSession(sessionWith({ nickname: 'Sprugging' }));
      expect(result.results[0].driverName).toBe('Sprugging');
    });

    it('falls back to "Unknown" when neither real name nor nickname is on file', () => {
      const result = parseAcEvoSession(sessionWith({}));
      expect(result.results[0].driverName).toBe('Unknown');
    });
  });

  describe('bestLapMs excludes invalid laps', () => {
    const guid = { a: '1', b: '1' };
    const carId = { a: '2', b: '2' };

    function sessionWithLaps(laps: { time: number; flags: number; split?: number[] }[]): unknown {
      return {
        session_type: 'Practice',
        drivers: [{ guid, first_name: 'Test', last_name: 'Driver', player_id: 'steam1' }],
        laps: laps.map((l) => ({
          car_key: carId,
          driver_key: guid,
          time: l.time,
          flags: l.flags,
          split: l.split,
        })),
        cars: [{ car_id: carId, model_displayname: 'Mazda MX-5 ND Cup' }],
        car_standings: [],
        driver_standings: [guid],
        time_standings: [0],
      };
    }

    it('picks the fastest VALID lap, not the fastest lap overall', () => {
      // fastest lap (90000ms) is invalid (flags=1); fastest valid lap is 95000ms (flags=2)
      const result = parseAcEvoSession(
        sessionWithLaps([
          { time: 90000, flags: 1 },
          { time: 95000, flags: 2 },
          { time: 99000, flags: 1 },
        ]),
      );
      expect(result.results[0].bestLapMs).toBe(95000);
    });

    it('bestLapMs is null when every lap is invalid', () => {
      const result = parseAcEvoSession(
        sessionWithLaps([
          { time: 90000, flags: 1 },
          { time: 91000, flags: 5 },
        ]),
      );
      expect(result.results[0].bestLapMs).toBeNull();
      expect(result.results[0].bestLap).toBeNull();
    });

    it('treats a lap with no flags field as valid', () => {
      const result = parseAcEvoSession(sessionWithLaps([{ time: 90000, flags: undefined as unknown as number }]));
      expect(result.results[0].bestLapMs).toBe(90000);
    });
  });

  describe('sectorsMs', () => {
    const guid = { a: '1', b: '1' };
    const carId = { a: '2', b: '2' };

    function sessionWithLaps(laps: { time: number; flags: number; split?: number[] }[]): unknown {
      return {
        session_type: 'Practice',
        drivers: [{ guid, first_name: 'Test', last_name: 'Driver', player_id: 'steam1' }],
        laps: laps.map((l) => ({
          car_key: carId,
          driver_key: guid,
          time: l.time,
          flags: l.flags,
          split: l.split,
        })),
        cars: [{ car_id: carId, model_displayname: 'Mazda MX-5 ND Cup' }],
        car_standings: [],
        driver_standings: [guid],
        time_standings: [0],
      };
    }

    it('takes sector splits from the fastest VALID lap, not just the fastest lap', () => {
      const result = parseAcEvoSession(
        sessionWithLaps([
          { time: 90000, flags: 1, split: [20000, 30000, 40000] }, // invalid — faster overall
          { time: 95000, flags: 2, split: [21000, 31000, 43000] }, // valid — this one wins
        ]),
      );
      expect(result.results[0].sectorsMs).toEqual([21000, 31000, 43000]);
    });

    it('is null when there is no valid lap', () => {
      const result = parseAcEvoSession(sessionWithLaps([{ time: 90000, flags: 1, split: [30000, 30000, 30000] }]));
      expect(result.results[0].sectorsMs).toBeNull();
    });

    it('is null when the winning lap has no split data', () => {
      const result = parseAcEvoSession(sessionWithLaps([{ time: 90000, flags: 2 }]));
      expect(result.results[0].sectorsMs).toBeNull();
    });
  });
});

// ── isValidLap ───────────────────────────────────────────────────────────────

describe('isValidLap', () => {
  // Empirically confirmed against Emperor's own leaderboard ground truth —
  // see scripts/validate-ac-evo-lap-flags.ts (776/776 match, zero contradictions).
  it.each([
    [1, false],
    [2, true],
    [5, false],
    [6, true],
    [129, false],
    [133, false],
  ])('flags=%i -> valid=%s', (flags, expected) => {
    expect(isValidLap(flags)).toBe(expected);
  });
});

// ── aggregateHotLapLeaderboard ──────────────────────────────────────────────

describe('aggregateHotLapLeaderboard', () => {
  function session(results: Partial<AcEvoSessionResult['results'][number]>[]): AcEvoSessionResult {
    return {
      sessionType: 'Practice',
      sessionName: null,
      track: 'Road Atlanta',
      trackLayout: 'GP',
      serverName: null,
      seasonGuid: null,
      championshipId: null,
      isCompleted: true,
      serverStartTime: null,
      results: results.map((r) => ({
        position: 1,
        driverName: 'Unknown',
        firstName: null,
        lastName: null,
        steamId: '',
        nation: null,
        carModel: null,
        raceNumber: null,
        startingPosition: null,
        lapsCompleted: 1,
        noLaps: false,
        bestLapMs: null,
        bestLap: null,
        sectorsMs: null,
        ...r,
      })),
    };
  }

  it('takes each driver\'s minimum bestLapMs across sessions', () => {
    const sessions = [
      session([{ steamId: 'A', driverName: 'Alice', bestLapMs: 95000 }]),
      session([{ steamId: 'A', driverName: 'Alice', bestLapMs: 93000 }]),
    ];
    const board = aggregateHotLapLeaderboard(sessions);
    expect(board).toHaveLength(1);
    expect(board[0].bestLapMs).toBe(93000);
  });

  it('carries sectorsMs from the winning session\'s entry', () => {
    const sessions = [
      session([{ steamId: 'A', driverName: 'Alice', bestLapMs: 95000, sectorsMs: [22000, 33000, 40000] }]),
      session([{ steamId: 'A', driverName: 'Alice', bestLapMs: 93000, sectorsMs: [21000, 32000, 40000] }]),
    ];
    const board = aggregateHotLapLeaderboard(sessions);
    expect(board[0].sectorsMs).toEqual([21000, 32000, 40000]);
  });

  it('ranks multiple drivers ascending by lap time', () => {
    const sessions = [
      session([
        { steamId: 'A', driverName: 'Alice', bestLapMs: 95000 },
        { steamId: 'B', driverName: 'Bob', bestLapMs: 93000 },
      ]),
    ];
    const board = aggregateHotLapLeaderboard(sessions);
    expect(board.map((e) => e.driverName)).toEqual(['Bob', 'Alice']);
    expect(board.map((e) => e.rank)).toEqual([1, 2]);
  });

  it('dedupes by steamId, not driver name', () => {
    const sessions = [
      session([{ steamId: 'A', driverName: 'Alice', bestLapMs: 95000 }]),
      session([{ steamId: 'A', driverName: 'Alice (renamed)', bestLapMs: 93000 }]),
    ];
    const board = aggregateHotLapLeaderboard(sessions);
    expect(board).toHaveLength(1);
    expect(board[0].driverName).toBe('Alice (renamed)');
  });

  it('ignores entries with null bestLapMs (no valid laps that session)', () => {
    const sessions = [session([{ steamId: 'A', driverName: 'Alice', bestLapMs: null }])];
    expect(aggregateHotLapLeaderboard(sessions)).toEqual([]);
  });

  it('ignores entries with no steamId', () => {
    const sessions = [session([{ steamId: '', driverName: 'Unknown', bestLapMs: 95000 }])];
    expect(aggregateHotLapLeaderboard(sessions)).toEqual([]);
  });

  it('returns empty array for no sessions', () => {
    expect(aggregateHotLapLeaderboard([])).toEqual([]);
  });
});
