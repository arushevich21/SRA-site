import { describe, it, expect } from 'vitest';
import { buildUnregisteredByDivision, type RosterDriver } from './unregistered-drivers.js';

const DIVISIONS = [
  { id: 1, name: 'Division 1' },
  { id: 2, name: 'Division 2' },
];

const d = (id: string, name: string | null, divisionId: number | null): RosterDriver => ({
  id,
  displayName: name,
  divisionId,
  tier: null,
  isSralien: false,
});

describe('buildUnregisteredByDivision', () => {
  it('lists roster drivers with no claim, per division, A→Z', () => {
    const rows = buildUnregisteredByDivision(
      [d('a', 'Zoe', 1), d('b', 'adam', 1), d('c', 'Mia', 1), d('e', 'Eli', 2)],
      new Set(['c']),
      DIVISIONS,
    );
    expect(rows[0]).toMatchObject({ divisionId: 1, rosterCount: 3, registeredCount: 1 });
    expect(rows[0].unregistered.map((x) => x.displayName)).toEqual(['adam', 'Zoe']);
    expect(rows[1]).toMatchObject({ divisionId: 2, rosterCount: 1, registeredCount: 0 });
  });

  it('counts a waitlisted claim as registered (caller passes every claim)', () => {
    const rows = buildUnregisteredByDivision([d('a', 'A', 1)], new Set(['a']), DIVISIONS);
    expect(rows[0].unregistered).toEqual([]);
    expect(rows[0].registeredCount).toBe(1);
  });

  it('ignores ungraded drivers and keeps empty divisions', () => {
    const rows = buildUnregisteredByDivision([d('x', 'Nobody', null)], new Set(), DIVISIONS);
    expect(rows.map((r) => r.rosterCount)).toEqual([0, 0]);
  });

  it('handles a null display name without throwing', () => {
    const rows = buildUnregisteredByDivision([d('a', null, 1), d('b', 'Bea', 1)], new Set(), DIVISIONS);
    expect(rows[0].unregistered.map((x) => x.id)).toEqual(['a', 'b']);
  });
});
