import { describe, it, expect } from 'vitest';
import {
  aggregateSweatshop,
  validPercent,
  validityTier,
  type SweatshopLapRow,
} from './sweatshop.js';

function row(
  steamId: string,
  trackKey: string,
  totalLaps: number,
  validLaps: number,
  bestLapMs = 100_000,
  driverName = 'Driver ' + steamId,
): SweatshopLapRow {
  return { steamId, driverName, trackKey, totalLaps, validLaps, bestLapMs };
}

describe('aggregateSweatshop', () => {
  it('sums laps across a driver\'s cars and tracks', () => {
    // One driver, two cars at Silverstone (two rows) plus Paul Ricard.
    const result = aggregateSweatshop([
      row('1', 'silverstone', 100, 60),
      row('1', 'silverstone', 20, 10),
      row('1', 'paul_ricard', 30, 30),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ steamId: '1', laps: 150, validLaps: 100, rank: 1 });
  });

  it('filters to one track when given a trackKey', () => {
    const result = aggregateSweatshop(
      [row('1', 'silverstone', 100, 60), row('1', 'paul_ricard', 30, 30), row('2', 'paul_ricard', 50, 40)],
      { trackKey: 'paul_ricard' },
    );
    expect(result.map((d) => [d.steamId, d.laps])).toEqual([
      ['2', 50],
      ['1', 30],
    ]);
  });

  it('sorts by laps descending and gives tied drivers the same rank', () => {
    const result = aggregateSweatshop([
      row('a', 't', 50, 50),
      row('b', 't', 80, 80),
      row('c', 't', 80, 80),
      row('d', 't', 10, 10),
    ]);
    expect(result.map((d) => [d.steamId, d.rank])).toEqual([
      ['b', 1],
      ['c', 1],
      ['a', 3],
      ['d', 4],
    ]);
  });

  it('drops drivers whose rows add up to zero laps', () => {
    expect(aggregateSweatshop([row('1', 't', 0, 0)])).toEqual([]);
  });

  it('keeps the snapshot name from the driver\'s busiest row', () => {
    const result = aggregateSweatshop([
      row('1', 't', 5, 5, 100_000, 'Old Name'),
      row('1', 'u', 90, 80, 100_000, 'New Name'),
    ]);
    expect(result[0].driverName).toBe('New Name');
  });

  it('estimates time lapping from each row\'s laps × its best lap', () => {
    // 60 laps at 1:40 + 30 laps at 2:00 = 6000s + 3600s.
    const result = aggregateSweatshop([row('1', 't', 60, 60, 100_000), row('1', 'u', 30, 30, 120_000)]);
    expect(result[0].approxSecondsLapping).toBe(9600);
  });
});

describe('validPercent', () => {
  it('rounds to a whole percent', () => {
    expect(validPercent({ laps: 3, validLaps: 2 })).toBe(67);
  });

  it('is null with no laps', () => {
    expect(validPercent({ laps: 0, validLaps: 0 })).toBeNull();
  });
});

describe('validityTier', () => {
  // Field: 70% valid.
  const field = [
    { laps: 100, validLaps: 70 },
    { laps: 100, validLaps: 70 },
  ];
  const at = (pct: number) => validityTier({ laps: 100, validLaps: pct }, field);

  it('is spotless 10+ points above the field', () => {
    expect(at(80)).toBe('spotless');
    expect(at(79)).toBe('clean');
  });

  it('is clean within 10 points either side', () => {
    expect(at(70)).toBe('clean');
    expect(at(61)).toBe('clean');
  });

  it('steps down every 10 points below the field', () => {
    expect(at(60)).toBe('sloppy');
    expect(at(51)).toBe('sloppy');
    expect(at(50)).toBe('wild');
    expect(at(41)).toBe('wild');
    expect(at(40)).toBe('feral');
    expect(at(5)).toBe('feral');
  });

  it('weights the field by laps, not by driver', () => {
    // One grinder at 50% dominates the field rate (≈52%), so 45% is only clean.
    const lopsided = [
      { laps: 1000, validLaps: 500 },
      { laps: 10, validLaps: 10 },
      { laps: 10, validLaps: 10 },
    ];
    expect(validityTier({ laps: 100, validLaps: 45 }, lopsided)).toBe('clean');
  });

  it('is clean with no laps to judge', () => {
    expect(validityTier({ laps: 0, validLaps: 0 }, field)).toBe('clean');
    expect(validityTier({ laps: 10, validLaps: 5 }, [])).toBe('clean');
  });
});
