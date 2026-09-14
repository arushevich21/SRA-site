import { describe, it, expect } from 'vitest';
import { buildDivisionCapacity } from './division-capacity.js';

const DIVISIONS = [
  { id: 1, name: 'Division 1' },
  { id: 2, name: 'Division 2' },
];

describe('buildDivisionCapacity', () => {
  it('sums drivers per division, not entries', () => {
    // Three two-driver teams in D1 = 6 drivers, not 3.
    const rows = buildDivisionCapacity(
      [
        { divisionId: 1, driverCount: 2 },
        { divisionId: 1, driverCount: 2 },
        { divisionId: 1, driverCount: 2 },
        { divisionId: 2, driverCount: 1 },
      ],
      DIVISIONS,
      55,
    );
    expect(rows.map((r) => [r.divisionId, r.driverCount])).toEqual([
      [1, 6],
      [2, 1],
    ]);
  });

  it('includes divisions with nobody signed up', () => {
    const rows = buildDivisionCapacity([], DIVISIONS, 55);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.driverCount === 0)).toBe(true);
  });

  it('flags a division at exactly the cap, not one driver later', () => {
    const rows = buildDivisionCapacity([{ divisionId: 1, driverCount: 55 }], DIVISIONS, 55);
    expect(rows[0].atCapacity).toBe(true);
    expect(rows[1].atCapacity).toBe(false);
  });

  it('allows going past the cap — it is an indicator, not a gate', () => {
    const rows = buildDivisionCapacity([{ divisionId: 1, driverCount: 62 }], DIVISIONS, 55);
    expect(rows[0].driverCount).toBe(62);
    expect(rows[0].atCapacity).toBe(true);
  });

  it('never reports capacity when the championship sets no target', () => {
    const rows = buildDivisionCapacity([{ divisionId: 1, driverCount: 999 }], DIVISIONS, null);
    expect(rows[0].cap).toBeNull();
    expect(rows[0].atCapacity).toBe(false);
  });

  it('ignores entries with no division rather than misattributing them', () => {
    const rows = buildDivisionCapacity(
      [
        { divisionId: null, driverCount: 4 },
        { divisionId: 1, driverCount: 2 },
      ],
      DIVISIONS,
      55,
    );
    expect(rows[0].driverCount).toBe(2);
    expect(rows.reduce((n, r) => n + r.driverCount, 0)).toBe(2);
  });
});
