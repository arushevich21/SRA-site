import { describe, it, expect } from 'vitest';
import {
  emptyLedger,
  applyRuling,
  recordAttendance,
  recordAbsence,
  computeActivePp,
  getEligibility,
} from './penalty-ledger.js';
import type { PpEvent, RaceRef, Ruling } from '@sra/shared-types';

// ─── test helpers ─────────────────────────────────────────────────────────────

function ref(seasonId: string, raceIndex: number, globalSeq: number): RaceRef {
  return { seasonId, raceIndex, globalSeq };
}

function ppev(
  globalSeq: number,
  points: number,
  reason: PpEvent['reason'] = 'ruling',
): PpEvent {
  return { raceRef: ref('S1', 1, globalSeq), points, reason };
}

function mkRuling(overrides: Partial<Ruling> & { raceRef: RaceRef }): Ruling {
  return {
    driverId: 'd1',
    penaltyPoints: 0,
    warnings: 0,
    isLap1: false,
    returnedPosition: false,
    isQualifyingIncident: false,
    ...overrides,
  };
}

// ─── emptyLedger ──────────────────────────────────────────────────────────────

describe('emptyLedger', () => {
  it('returns a zeroed-out state for the given driverId', () => {
    const s = emptyLedger('d1');
    expect(s.driverId).toBe('d1');
    expect(s.ppHistory).toEqual([]);
    expect(s.raceWarnings).toEqual([]);
    expect(s.qualWarnings).toEqual([]);
    expect(s.pendingBans).toEqual([]);
    expect(s.seasonAdministration).toEqual([]);
    expect(s.seasonBan).toBeNull();
  });
});

// ─── computeActivePp ──────────────────────────────────────────────────────────

describe('computeActivePp', () => {
  it('returns 0 for an empty history', () => {
    expect(computeActivePp([], ref('S1', 1, 5))).toBe(0);
  });

  it('sums all events within the 8-race rolling window', () => {
    const history: PpEvent[] = [ppev(3, 1), ppev(5, 2)];
    // asOfRace.globalSeq = 9 → window [2, 9] → both events included
    expect(computeActivePp(history, ref('S1', 9, 9))).toBe(3);
  });

  it('includes an event exactly 7 races back (globalSeq diff = 7)', () => {
    // asOfRace.globalSeq = 8; event.globalSeq = 1 → diff = 7 → inside window
    expect(computeActivePp([ppev(1, 2)], ref('S1', 8, 8))).toBe(2);
  });

  it('excludes an event 8 races back (globalSeq diff = 8)', () => {
    // asOfRace.globalSeq = 9; event.globalSeq = 1 → diff = 8 → expired
    const history: PpEvent[] = [ppev(1, 2), ppev(9, 1)];
    expect(computeActivePp(history, ref('S1', 9, 9))).toBe(1);
  });

  it('carries across seasons when globalSeq is continuous', () => {
    const history: PpEvent[] = [
      { raceRef: ref('S1', 12, 12), points: 2, reason: 'ruling' },
      { raceRef: ref('S2', 1, 15), points: 1, reason: 'ruling' },
    ];
    // asOfRace.globalSeq = 15 → window [8, 15] → both events included
    expect(computeActivePp(history, ref('S2', 1, 15))).toBe(3);
  });
});

// ─── applyRuling — warnings → pp ──────────────────────────────────────────────

describe('applyRuling — warnings', () => {
  it('a single warning adds to raceWarnings with no pp', () => {
    const s0 = emptyLedger('d1');
    const { state, effects } = applyRuling(s0, mkRuling({ raceRef: ref('S1', 1, 1), warnings: 1 }));
    expect(effects.effectivePp).toBe(0);
    expect(effects.warningConvertedToPp).toBe(false);
    expect(state.raceWarnings).toHaveLength(1);
  });

  it('two warnings in the same race convert to 1 pp', () => {
    const s0 = emptyLedger('d1');
    const r1 = ref('S1', 1, 1);
    const { state: s1 } = applyRuling(s0, mkRuling({ raceRef: r1, warnings: 1 }));
    const { state: s2, effects } = applyRuling(s1, mkRuling({ raceRef: r1, warnings: 1 }));
    expect(effects.warningConvertedToPp).toBe(true);
    expect(effects.effectivePp).toBe(1);
    expect(s2.raceWarnings).toHaveLength(0);
  });

  it('two warnings in consecutive races (globalSeq diff = 1) convert to 1 pp', () => {
    const s0 = emptyLedger('d1');
    const { state: s1 } = applyRuling(s0, mkRuling({ raceRef: ref('S1', 1, 1), warnings: 1 }));
    const { state: s2, effects } = applyRuling(
      s1,
      mkRuling({ raceRef: ref('S1', 2, 2), warnings: 1 }),
    );
    expect(effects.warningConvertedToPp).toBe(true);
    expect(s2.raceWarnings).toHaveLength(0);
  });

  it('two warnings 2 races apart (globalSeq diff = 2) do not convert', () => {
    const s0 = emptyLedger('d1');
    const { state: s1 } = applyRuling(s0, mkRuling({ raceRef: ref('S1', 1, 1), warnings: 1 }));
    const { state: s2, effects } = applyRuling(
      s1,
      mkRuling({ raceRef: ref('S1', 3, 3), warnings: 1 }),
    );
    expect(effects.warningConvertedToPp).toBe(false);
    expect(s2.raceWarnings).toHaveLength(2);
  });

  it('returnedPosition: removes one warning from the ruling; pp is unchanged', () => {
    const s0 = emptyLedger('d1');
    const { state, effects } = applyRuling(
      s0,
      mkRuling({ raceRef: ref('S1', 1, 1), penaltyPoints: 1, warnings: 1, returnedPosition: true }),
    );
    expect(effects.effectivePp).toBe(1);
    expect(effects.warningConvertedToPp).toBe(false);
    expect(state.raceWarnings).toHaveLength(0);
  });

  it('three warnings: first pair converts to 1 pp; third warning remains', () => {
    let state = emptyLedger('d1');
    const r1 = ref('S1', 1, 1);
    ({ state } = applyRuling(state, mkRuling({ raceRef: r1, warnings: 1 })));
    ({ state } = applyRuling(state, mkRuling({ raceRef: r1, warnings: 1 })));
    ({ state } = applyRuling(state, mkRuling({ raceRef: r1, warnings: 1 })));
    expect(state.raceWarnings).toHaveLength(1);
    expect(computeActivePp(state.ppHistory, r1)).toBe(1);
  });
});

// ─── applyRuling — L1AUTO escalation ──────────────────────────────────────────

describe('applyRuling — L1AUTO', () => {
  it('escalates penaltyPoints by 1 on a non-qualifying incident', () => {
    const { effects } = applyRuling(
      emptyLedger('d1'),
      mkRuling({ raceRef: ref('S1', 1, 1), penaltyPoints: 1, isLap1: true }),
    );
    expect(effects.effectivePp).toBe(2);
  });

  it('does not escalate a qualifying incident (L1AUTO flag ignored)', () => {
    const { state } = applyRuling(
      emptyLedger('d1'),
      mkRuling({ raceRef: ref('S1', 1, 1), warnings: 1, isLap1: true, isQualifyingIncident: true }),
    );
    expect(state.ppHistory).toHaveLength(0);
    expect(state.qualWarnings).toHaveLength(1);
  });
});

// ─── applyRuling — consecutive-race bonus ─────────────────────────────────────

describe('applyRuling — consecutive-race bonus', () => {
  it('two pp infractions in the same race add a +1 consecutive bonus', () => {
    let state = emptyLedger('d1');
    const r1 = ref('S1', 1, 1);
    ({ state } = applyRuling(state, mkRuling({ raceRef: r1, penaltyPoints: 1 })));
    const { effects } = applyRuling(state, mkRuling({ raceRef: r1, penaltyPoints: 1 }));
    expect(effects.ppBreakdown.some((e) => e.reason === 'consecutive-bonus')).toBe(true);
    expect(effects.ppBreakdown.find((e) => e.reason === 'consecutive-bonus')?.points).toBe(1);
  });

  it('two pp infractions in consecutive races (globalSeq diff = 1) add a +1 consecutive bonus', () => {
    let state = emptyLedger('d1');
    ({ state } = applyRuling(state, mkRuling({ raceRef: ref('S1', 1, 1), penaltyPoints: 1 })));
    const { effects } = applyRuling(
      state,
      mkRuling({ raceRef: ref('S1', 2, 2), penaltyPoints: 1 }),
    );
    expect(effects.ppBreakdown.some((e) => e.reason === 'consecutive-bonus')).toBe(true);
  });

  it('two pp infractions 2 races apart yield no consecutive bonus', () => {
    let state = emptyLedger('d1');
    ({ state } = applyRuling(state, mkRuling({ raceRef: ref('S1', 1, 1), penaltyPoints: 1 })));
    const { effects } = applyRuling(
      state,
      mkRuling({ raceRef: ref('S1', 3, 3), penaltyPoints: 1 }),
    );
    expect(effects.ppBreakdown.every((e) => e.reason !== 'consecutive-bonus')).toBe(true);
  });

  it('the consecutive bonus does not itself trigger another consecutive bonus', () => {
    let state = emptyLedger('d1');
    const r1 = ref('S1', 1, 1);
    ({ state } = applyRuling(state, mkRuling({ raceRef: r1, penaltyPoints: 1 })));
    ({ state } = applyRuling(state, mkRuling({ raceRef: r1, penaltyPoints: 1 })));
    // third infraction at the same race: exactly one consecutive-bonus, not two
    const { effects } = applyRuling(state, mkRuling({ raceRef: r1, penaltyPoints: 1 }));
    expect(effects.ppBreakdown.filter((e) => e.reason === 'consecutive-bonus')).toHaveLength(1);
  });
});

// ─── applyRuling — thresholds (once per season) ───────────────────────────────

describe('applyRuling — thresholds', () => {
  it('crossing 4 pp issues a qualifying ban', () => {
    const { effects } = applyRuling(
      emptyLedger('d1'),
      mkRuling({ raceRef: ref('S1', 1, 1), penaltyPoints: 4 }),
    );
    expect(effects.bansIssued.some((b) => b.type === 'qualifying_ban')).toBe(true);
  });

  it('crossing 6 pp issues a pit-lane start', () => {
    let state = emptyLedger('d1');
    ({ state } = applyRuling(state, mkRuling({ raceRef: ref('S1', 1, 1), penaltyPoints: 4 })));
    const { effects } = applyRuling(
      state,
      mkRuling({ raceRef: ref('S1', 2, 2), penaltyPoints: 2 }),
    );
    expect(effects.bansIssued.some((b) => b.type === 'pit_lane_start')).toBe(true);
  });

  it('crossing 8 pp issues a race ban', () => {
    let state = emptyLedger('d1');
    ({ state } = applyRuling(state, mkRuling({ raceRef: ref('S1', 1, 1), penaltyPoints: 4 })));
    ({ state } = applyRuling(state, mkRuling({ raceRef: ref('S1', 2, 2), penaltyPoints: 2 })));
    const { effects } = applyRuling(
      state,
      mkRuling({ raceRef: ref('S1', 3, 3), penaltyPoints: 2 }),
    );
    expect(effects.bansIssued.some((b) => b.type === 'race_ban')).toBe(true);
  });

  it('crossing 10 pp triggers an active season ban', () => {
    const { state } = applyRuling(
      emptyLedger('d1'),
      mkRuling({ raceRef: ref('S1', 1, 1), penaltyPoints: 10 }),
    );
    expect(state.seasonBan?.active).toBe(true);
    expect(state.seasonBan?.issuedAtRace.globalSeq).toBe(1);
  });

  it('4 pp threshold administered only once per season: second crossing issues no new qualifying ban', () => {
    let state = emptyLedger('d1');
    ({ state } = applyRuling(state, mkRuling({ raceRef: ref('S1', 1, 1), penaltyPoints: 4 })));
    // add 2pp → 6pp total: pit-lane start issued, but NOT a second qualifying ban
    const { effects } = applyRuling(
      state,
      mkRuling({ raceRef: ref('S1', 2, 2), penaltyPoints: 2 }),
    );
    expect(effects.bansIssued.every((b) => b.type !== 'qualifying_ban')).toBe(true);
    expect(effects.bansIssued.some((b) => b.type === 'pit_lane_start')).toBe(true);
  });

  it('pp are NOT cleared after a pending ban is served', () => {
    let state = emptyLedger('d1');
    ({ state } = applyRuling(state, mkRuling({ raceRef: ref('S1', 1, 1), penaltyPoints: 4 })));
    const ppBefore = computeActivePp(state.ppHistory, ref('S1', 2, 2));
    state = recordAttendance(state, ref('S1', 2, 2));
    expect(computeActivePp(state.ppHistory, ref('S1', 2, 2))).toBe(ppBefore);
  });

  it('thresholds reset each season: 4 pp in a new season re-issues the qualifying ban', () => {
    let state = emptyLedger('d1');
    // S1: 4pp → qualifying ban administered in S1
    ({ state } = applyRuling(state, mkRuling({ raceRef: ref('S1', 1, 1), penaltyPoints: 4 })));
    // S2: 1pp ruling when S1 pp still in rolling window (globalSeq diff = 1 ≤ 7)
    // active pp = 5; 4pp not yet administered in S2 → qualifying ban issued again
    const { effects } = applyRuling(
      state,
      mkRuling({ raceRef: ref('S2', 1, 2), penaltyPoints: 1 }),
    );
    expect(effects.bansIssued.some((b) => b.type === 'qualifying_ban')).toBe(true);
  });
});

// ─── applyRuling — qualifying track ───────────────────────────────────────────

describe('applyRuling — qualifying track', () => {
  it('a qualifying incident does not add to ppHistory', () => {
    const { state } = applyRuling(
      emptyLedger('d1'),
      mkRuling({ raceRef: ref('S1', 1, 1), warnings: 1, isQualifyingIncident: true }),
    );
    expect(state.ppHistory).toHaveLength(0);
    expect(state.qualWarnings).toHaveLength(1);
  });

  it('first qualifying warning in a season: no qualifying ban', () => {
    const { effects } = applyRuling(
      emptyLedger('d1'),
      mkRuling({ raceRef: ref('S1', 1, 1), warnings: 1, isQualifyingIncident: true }),
    );
    expect(effects.qualBanIssued).toBe(false);
  });

  it('second qualifying warning in the same season issues a qualifying ban', () => {
    let state = emptyLedger('d1');
    ({ state } = applyRuling(
      state,
      mkRuling({ raceRef: ref('S1', 1, 1), warnings: 1, isQualifyingIncident: true }),
    ));
    const { effects } = applyRuling(
      state,
      mkRuling({ raceRef: ref('S1', 2, 2), warnings: 1, isQualifyingIncident: true }),
    );
    expect(effects.qualBanIssued).toBe(true);
    expect(effects.bansIssued.some((b) => b.type === 'qualifying_ban')).toBe(true);
  });

  it('qualifying warnings from different seasons do not combine', () => {
    let state = emptyLedger('d1');
    ({ state } = applyRuling(
      state,
      mkRuling({ raceRef: ref('S1', 5, 5), warnings: 1, isQualifyingIncident: true }),
    ));
    const { effects } = applyRuling(
      state,
      mkRuling({ raceRef: ref('S2', 1, 6), warnings: 1, isQualifyingIncident: true }),
    );
    expect(effects.qualBanIssued).toBe(false);
  });
});

// ─── recordAttendance ─────────────────────────────────────────────────────────

describe('recordAttendance', () => {
  it('serves the first unserved pending ban when attending', () => {
    let state = emptyLedger('d1');
    ({ state } = applyRuling(state, mkRuling({ raceRef: ref('S1', 1, 1), penaltyPoints: 4 })));
    state = recordAttendance(state, ref('S1', 2, 2));
    expect(state.pendingBans.find((b) => b.type === 'qualifying_ban')?.served).toBe(true);
  });

  it('stacked bans are served one per attended race', () => {
    let state = emptyLedger('d1');
    // 6pp → qualifying_ban + pit_lane_start both issued
    ({ state } = applyRuling(state, mkRuling({ raceRef: ref('S1', 1, 1), penaltyPoints: 6 })));
    const unservedBefore = state.pendingBans.filter((b) => !b.served).length;
    state = recordAttendance(state, ref('S1', 2, 2));
    expect(state.pendingBans.filter((b) => !b.served).length).toBe(unservedBefore - 1);
  });

  it('pending bans from a prior season are dropped without being served', () => {
    let state = emptyLedger('d1');
    ({ state } = applyRuling(state, mkRuling({ raceRef: ref('S1', 12, 12), penaltyPoints: 4 })));
    state = recordAttendance(state, ref('S2', 1, 13));
    expect(state.pendingBans.filter((b) => b.seasonId === 'S1')).toHaveLength(0);
  });
});

// ─── recordAbsence ────────────────────────────────────────────────────────────

describe('recordAbsence', () => {
  it('increments racesMissedSinceIssued on each pending ban', () => {
    let state = emptyLedger('d1');
    ({ state } = applyRuling(state, mkRuling({ raceRef: ref('S1', 1, 1), penaltyPoints: 4 })));
    state = recordAbsence(state, ref('S1', 2, 2));
    expect(state.pendingBans[0]?.racesMissedSinceIssued).toBe(1);
  });

  it('missing 1 race does not clear the pending ban', () => {
    let state = emptyLedger('d1');
    ({ state } = applyRuling(state, mkRuling({ raceRef: ref('S1', 1, 1), penaltyPoints: 4 })));
    state = recordAbsence(state, ref('S1', 2, 2));
    expect(state.pendingBans.filter((b) => b.type === 'qualifying_ban')).toHaveLength(1);
  });

  it('missing 2 races clears the pending ban without serving', () => {
    let state = emptyLedger('d1');
    ({ state } = applyRuling(state, mkRuling({ raceRef: ref('S1', 1, 1), penaltyPoints: 4 })));
    state = recordAbsence(state, ref('S1', 2, 2));
    state = recordAbsence(state, ref('S1', 3, 3));
    expect(state.pendingBans.filter((b) => b.type === 'qualifying_ban' && !b.served)).toHaveLength(0);
  });

  it('pending bans from a prior season are dropped on absence', () => {
    let state = emptyLedger('d1');
    ({ state } = applyRuling(state, mkRuling({ raceRef: ref('S1', 12, 12), penaltyPoints: 4 })));
    state = recordAbsence(state, ref('S2', 1, 13));
    expect(state.pendingBans.filter((b) => b.seasonId === 'S1')).toHaveLength(0);
  });

  it('increments racesAbsent on an active season ban', () => {
    let state = emptyLedger('d1');
    ({ state } = applyRuling(state, mkRuling({ raceRef: ref('S1', 1, 1), penaltyPoints: 10 })));
    state = recordAbsence(state, ref('S1', 2, 2));
    expect(state.seasonBan?.racesAbsent).toBe(1);
  });
});

// ─── season ban — return conditions ───────────────────────────────────────────

describe('season ban — return conditions', () => {
  it('driver cannot return while active pp is still >= 10', () => {
    let state = emptyLedger('d1');
    ({ state } = applyRuling(state, mkRuling({ raceRef: ref('S1', 1, 1), penaltyPoints: 10 })));
    state = recordAbsence(state, ref('S1', 2, 2));
    state = recordAttendance(state, ref('S1', 3, 3));
    expect(state.seasonBan?.active).toBe(true);
  });

  it('driver can return once active pp drops below 10 via rolling-window expiry', () => {
    let state = emptyLedger('d1');
    // 10pp at globalSeq=1; expires when asOfRace.globalSeq > 8
    ({ state } = applyRuling(state, mkRuling({ raceRef: ref('S1', 1, 1), penaltyPoints: 10 })));
    for (let i = 2; i <= 10; i++) state = recordAbsence(state, ref('S1', i, i));
    // at globalSeq=11: diff = 10 > 7 → expired → activePp = 0 → can return
    state = recordAttendance(state, ref('S1', 11, 11));
    expect(state.seasonBan?.active).toBe(false);
    expect(state.seasonBan?.onProbation).toBe(true);
  });

  it('ban in first 4 races: requires racesAbsent >= 2 AND pp < 10 to return', () => {
    let state = emptyLedger('d1');
    // raceIndex=3 ≤ 4 → bannedInFirstFourRaces = true
    ({ state } = applyRuling(state, mkRuling({ raceRef: ref('S1', 3, 3), penaltyPoints: 10 })));
    for (let i = 4; i <= 12; i++) state = recordAbsence(state, ref('S1', i, i));
    // racesAbsent = 9 ≥ 2 ✓; activePp = 0 (pp at seq=3 expired by seq=11) ✓
    state = recordAttendance(state, ref('S1', 13, 13));
    expect(state.seasonBan?.active).toBe(false);
  });

  it('ban in first 4 races: pp < 10 but only 1 race absent — cannot return yet', () => {
    let state = emptyLedger('d1');
    ({ state } = applyRuling(state, mkRuling({ raceRef: ref('S1', 2, 2), penaltyPoints: 10 })));
    state = recordAbsence(state, ref('S1', 3, 3));   // racesAbsent = 1, pp still active
    state = recordAttendance(state, ref('S1', 4, 4));
    expect(state.seasonBan?.active).toBe(true);
  });

  it('ban after first 4 races: pp < 10 alone is sufficient to return', () => {
    let state = emptyLedger('d1');
    // raceIndex=5 > 4 → bannedInFirstFourRaces = false
    ({ state } = applyRuling(state, mkRuling({ raceRef: ref('S1', 5, 5), penaltyPoints: 10 })));
    for (let i = 6; i <= 14; i++) state = recordAbsence(state, ref('S1', i, i));
    // at globalSeq=15: pp from seq=5 is 10 races back → expired → activePp=0 → can return
    state = recordAttendance(state, ref('S1', 15, 15));
    expect(state.seasonBan?.active).toBe(false);
    expect(state.seasonBan?.onProbation).toBe(true);
  });
});

// ─── season ban — probation ────────────────────────────────────────────────────

describe('season ban — probation', () => {
  function afterBanAndReturn() {
    let state = emptyLedger('d1');
    // ban at raceIndex=5, globalSeq=5 (not in first 4 races)
    ({ state } = applyRuling(state, mkRuling({ raceRef: ref('S1', 5, 5), penaltyPoints: 10 })));
    for (let i = 6; i <= 14; i++) state = recordAbsence(state, ref('S1', i, i));
    // pp expires at globalSeq ≥ 13 (diff > 7); attend race 15 → return + probation race 1
    state = recordAttendance(state, ref('S1', 15, 15));
    return state; // probationRacesAttended = 1
  }

  it('accumulating 3 pp within first 4 races back triggers another season ban', () => {
    let state = afterBanAndReturn();
    ({ state } = applyRuling(state, mkRuling({ raceRef: ref('S1', 16, 16), penaltyPoints: 3 })));
    expect(state.seasonBan?.active).toBe(true);
  });

  it('accumulating 2 pp within first 4 races back does not trigger a new ban', () => {
    let state = afterBanAndReturn();
    ({ state } = applyRuling(state, mkRuling({ raceRef: ref('S1', 16, 16), penaltyPoints: 2 })));
    expect(state.seasonBan?.active).toBe(false);
    expect(state.seasonBan?.onProbation).toBe(true);
  });

  it('pp after the first 4 races back does not trigger the probation ban', () => {
    let state = afterBanAndReturn(); // probationRacesAttended = 1
    for (let i = 16; i <= 19; i++) state = recordAttendance(state, ref('S1', i, i));
    // probationRacesAttended = 5 > 4 → outside probation window
    ({ state } = applyRuling(state, mkRuling({ raceRef: ref('S1', 20, 20), penaltyPoints: 3 })));
    expect(state.seasonBan?.active).toBe(false);
  });
});

// ─── getEligibility ────────────────────────────────────────────────────────────

describe('getEligibility', () => {
  it('driver with no bans and no pp is fully eligible', () => {
    const elig = getEligibility(emptyLedger('d1'), ref('S1', 1, 1));
    expect(elig.isSeasonBanned).toBe(false);
    expect(elig.isRaceBanned).toBe(false);
    expect(elig.mustStartFromPitLane).toBe(false);
    expect(elig.hasQualifyingBan).toBe(false);
    expect(elig.isOnProbation).toBe(false);
    expect(elig.activePp).toBe(0);
  });

  it('driver with an unserved qualifying ban has hasQualifyingBan = true', () => {
    let state = emptyLedger('d1');
    ({ state } = applyRuling(state, mkRuling({ raceRef: ref('S1', 1, 1), penaltyPoints: 4 })));
    expect(getEligibility(state, ref('S1', 2, 2)).hasQualifyingBan).toBe(true);
  });

  it('driver with an unserved pit-lane start ban has mustStartFromPitLane = true', () => {
    let state = emptyLedger('d1');
    ({ state } = applyRuling(state, mkRuling({ raceRef: ref('S1', 1, 1), penaltyPoints: 6 })));
    expect(getEligibility(state, ref('S1', 2, 2)).mustStartFromPitLane).toBe(true);
  });

  it('driver with an unserved race ban has isRaceBanned = true', () => {
    let state = emptyLedger('d1');
    ({ state } = applyRuling(state, mkRuling({ raceRef: ref('S1', 1, 1), penaltyPoints: 8 })));
    expect(getEligibility(state, ref('S1', 2, 2)).isRaceBanned).toBe(true);
  });

  it('driver with an active season ban has isSeasonBanned = true', () => {
    let state = emptyLedger('d1');
    ({ state } = applyRuling(state, mkRuling({ raceRef: ref('S1', 1, 1), penaltyPoints: 10 })));
    expect(getEligibility(state, ref('S1', 2, 2)).isSeasonBanned).toBe(true);
  });

  it('driver on probation has isOnProbation = true', () => {
    let state = emptyLedger('d1');
    ({ state } = applyRuling(state, mkRuling({ raceRef: ref('S1', 5, 5), penaltyPoints: 10 })));
    for (let i = 6; i <= 14; i++) state = recordAbsence(state, ref('S1', i, i));
    state = recordAttendance(state, ref('S1', 15, 15));
    expect(getEligibility(state, ref('S1', 16, 16)).isOnProbation).toBe(true);
  });

  it('activePp reflects the 8-race rolling window', () => {
    let state = emptyLedger('d1');
    ({ state } = applyRuling(state, mkRuling({ raceRef: ref('S1', 1, 1), penaltyPoints: 3 })));
    // at globalSeq=10: diff = 9 > 7 → pp expired → activePp = 0
    expect(getEligibility(state, ref('S1', 10, 10)).activePp).toBe(0);
  });
});
