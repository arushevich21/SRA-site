import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseAcEvoSession } from './ac-evo-parser.js';

const FIXTURES = resolve(__dirname, '../../../fixtures/ac-evo-results');

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
});
