import { describe, it, expect } from 'vitest';
import {
  parseStandingsView,
  resolveActiveDivision,
  standingsViewHref,
  type StandingsView,
} from './standings-view.js';

const D1: StandingsView = { division: 1, entrant: 'drivers', tier: 'all' };

describe('parseStandingsView', () => {
  it('defaults to first division, drivers, all tiers', () => {
    expect(parseStandingsView({})).toEqual({ division: null, entrant: 'drivers', tier: 'all' });
  });

  it('reads all three axes', () => {
    expect(parseStandingsView({ division: '3', view: 'teams', tier: 'gold' })).toEqual({
      division: 3,
      entrant: 'teams',
      tier: 'gold',
    });
  });

  it('takes the first value when a key is repeated', () => {
    expect(parseStandingsView({ division: ['2', '4'] }).division).toBe(2);
  });

  it('falls back rather than breaking on a garbage division', () => {
    for (const bad of ['abc', '-1', '0', '1.5', '']) {
      expect(parseStandingsView({ division: bad }).division).toBeNull();
    }
  });

  it('falls back on an unrecognised view or tier', () => {
    const v = parseStandingsView({ view: 'cars', tier: 'platinum' });
    expect(v.entrant).toBe('drivers');
    expect(v.tier).toBe('all');
  });
});

describe('standingsViewHref', () => {
  const base = '/acc/championships/gt3-team-series-s19/standings';

  it('omits every default so the canonical view is a clean URL', () => {
    expect(standingsViewHref(base, { division: null, entrant: 'drivers', tier: 'all' }, {})).toBe(base);
  });

  it('carries the other axes forward when switching one', () => {
    const view: StandingsView = { division: 2, entrant: 'teams', tier: 'all' };
    expect(standingsViewHref(base, view, { division: 4 })).toBe(`${base}?division=4&view=teams`);
  });

  it('keeps a tier filter when switching division', () => {
    const view: StandingsView = { division: 1, entrant: 'drivers', tier: 'silver' };
    expect(standingsViewHref(base, view, { division: 3 })).toBe(`${base}?division=3&tier=silver`);
  });

  it('drops the tier filter on the teams view, which has no driver tiers', () => {
    const view: StandingsView = { division: 1, entrant: 'drivers', tier: 'gold' };
    expect(standingsViewHref(base, view, { entrant: 'teams' })).toBe(`${base}?division=1&view=teams`);
  });

  it('restores a clean drivers URL when clearing the tier filter', () => {
    expect(standingsViewHref(base, { ...D1, tier: 'gold' }, { tier: 'all' })).toBe(`${base}?division=1`);
  });
});

describe('resolveActiveDivision', () => {
  const ALL = [1, 2, 3, 4];

  it('honours an explicit request over the viewer own division', () => {
    // A D1 driver following a "here's D3's race" link must land on D3.
    expect(resolveActiveDivision(3, 1, ALL)).toBe(3);
  });

  it('falls back to the signed-in viewer division', () => {
    expect(resolveActiveDivision(null, 3, ALL)).toBe(3);
  });

  it('falls back to the first division when signed out', () => {
    expect(resolveActiveDivision(null, null, ALL)).toBe(1);
  });

  it('ignores a viewer division the series does not run', () => {
    // Graded into D4, but this series only fields two grids.
    expect(resolveActiveDivision(null, 4, [1, 2])).toBe(1);
  });

  it('ignores a requested division the series does not run', () => {
    expect(resolveActiveDivision(9, 2, ALL)).toBe(2);
  });

  it('returns null when the series runs no divisions', () => {
    expect(resolveActiveDivision(2, 2, [])).toBeNull();
  });

  it('respects division order rather than assuming 1 is first', () => {
    expect(resolveActiveDivision(null, null, [2, 3])).toBe(2);
  });
});
