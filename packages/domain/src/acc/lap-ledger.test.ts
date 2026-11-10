import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractAccDriverLaps,
  accLedgerFileKeyFromEmperorUrl,
  accLedgerSourceFromBaseUrl,
  accSessionAtFromFileName,
} from './lap-ledger.js';

const FIXTURES = resolve(fileURLToPath(new URL('../../../../fixtures/acc-results', import.meta.url)));

function loadFixture(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(FIXTURES, name), 'utf-8'));
}

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

function lap(carId: number, driverIndex: number, isValidForBest = true) {
  return { carId, driverIndex, isValidForBest, laptime: 100_000 };
}

function session(laps: unknown[], lines: unknown[]) {
  return { sessionType: 'R', trackName: 'spa', laps, sessionResult: { leaderBoardLines: lines } };
}

describe('extractAccDriverLaps', () => {
  const shared = session(
    [lap(1, 0), lap(1, 0, false), lap(1, 1), lap(1, 1), lap(1, 1, false), lap(2, 0), lap(99, 0)],
    [
      line(1, 32, [['S1', 'Amy', 'A'], ['S2', 'Ben', 'B']], 1),
      line(2, 30, [['S3', 'Cal', 'C']]),
    ],
  );
  const rows = Object.fromEntries(extractAccDriverLaps(shared).map((r) => [r.steamId, r]));

  it("attributes laps to the driver who drove them (driverIndex), not the car's current driver", () => {
    expect(rows.S1).toMatchObject({ laps: 2, validLaps: 1 });
    expect(rows.S2).toMatchObject({ laps: 3, validLaps: 2 });
  });

  it('keeps the S-prefixed playerId, car model and name', () => {
    expect(rows.S3).toEqual({ steamId: 'S3', carModelId: 30, driverName: 'Cal C', laps: 1, validLaps: 1 });
  });

  it('drops laps from a car with no leaderboard line', () => {
    expect(Object.values(rows).reduce((n, r) => n + r.laps, 0)).toBe(6);
  });

  it("falls back to the current driver when driverIndex is out of range", () => {
    const out = extractAccDriverLaps(session([lap(1, 7)], [line(1, 32, [['S1', 'Amy', 'A'], ['S2', 'Ben', 'B']], 1)]));
    expect(out).toEqual([{ steamId: 'S2', carModelId: 32, driverName: 'Ben B', laps: 1, validLaps: 1 }]);
  });

  it('skips drivers with no playerId and tolerates missing sections', () => {
    expect(extractAccDriverLaps(session([lap(1, 0)], [line(1, 32, [['', 'Ghost', '']])]))).toEqual([]);
    expect(extractAccDriverLaps({ sessionType: 'FP' })).toEqual([]);
    expect(extractAccDriverLaps(null)).toEqual([]);
  });

  it('accounts for every lap of a real race file', () => {
    const raw = loadFixture('260616_224355_R.json');
    const out = extractAccDriverLaps(raw);
    expect(out.reduce((n, r) => n + r.laps, 0)).toBe((raw.laps as unknown[]).length);
    expect(out.every((r) => r.validLaps >= 0 && r.validLaps <= r.laps)).toBe(true);
    expect(new Set(out.map((r) => `${r.steamId}:${r.carModelId}`)).size).toBe(out.length);
  });
});

describe('accLedgerFileKeyFromEmperorUrl', () => {
  it('maps an Emperor results URL to the same key SRA-Bot derives from disk', () => {
    // disk: .../accsm1/server/_manager/servers/server_0/results/260801_225206_R.json
    expect(accLedgerFileKeyFromEmperorUrl('accsm1', '/server/0/results/download/260801_225206_R.json')).toBe(
      'accsm1:server_0/260801_225206_R',
    );
  });

  it('rejects anything that is not a results download URL', () => {
    expect(accLedgerFileKeyFromEmperorUrl('accsm1', '/api/results/list.json')).toBeNull();
    expect(accLedgerFileKeyFromEmperorUrl('accsm1', '/server/0/results/download/notes.json')).toBeNull();
  });
});

describe('accLedgerSourceFromBaseUrl', () => {
  it('names the ACCSM host', () => {
    expect(accLedgerSourceFromBaseUrl('https://accsm1.simracingalliance.com')).toBe('accsm1');
    expect(accLedgerSourceFromBaseUrl('https://accsm2.simracingalliance.com/')).toBe('accsm2');
  });

  it('returns null for hosts the ledger has no source for', () => {
    expect(accLedgerSourceFromBaseUrl('https://accsm3.simracingalliance.com')).toBeNull();
    expect(accLedgerSourceFromBaseUrl('https://sram1acevo.emperorservers.com')).toBeNull();
  });
});

describe('accSessionAtFromFileName', () => {
  it('reads the YYMMDD_HHMMSS stamp as UTC', () => {
    expect(accSessionAtFromFileName('261012_134740_FP')?.toISOString()).toBe('2026-10-12T13:47:40.000Z');
    expect(accSessionAtFromFileName('261012_134740_FP.json')?.toISOString()).toBe('2026-10-12T13:47:40.000Z');
  });

  it('rejects names that are not result files or impossible dates', () => {
    expect(accSessionAtFromFileName('d1.json')).toBeNull();
    expect(accSessionAtFromFileName('261399_000000_R.json')).toBeNull();
  });
});
