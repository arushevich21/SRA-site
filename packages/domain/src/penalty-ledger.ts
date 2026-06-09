import type {
  DriverLedgerState,
  EligibilityStatus,
  PendingBan,
  PpEvent,
  RaceRef,
  Ruling,
  RulingEffect,
  SeasonAdministration,
  SeasonBanState,
} from '@sra/shared-types';

export function emptyLedger(driverId: string): DriverLedgerState {
  return {
    driverId,
    ppHistory: [],
    raceWarnings: [],
    qualWarnings: [],
    pendingBans: [],
    seasonAdministration: [],
    seasonBan: null,
  };
}

/**
 * Active PP = sum of events where globalSeq >= asOfRace.globalSeq − 7.
 * Rolling 8-race window: the current race plus the 7 preceding.
 */
export function computeActivePp(ppHistory: readonly PpEvent[], asOfRace: RaceRef): number {
  return ppHistory
    .filter((e) => asOfRace.globalSeq - e.raceRef.globalSeq <= 7)
    .reduce((sum, e) => sum + e.points, 0);
}

/**
 * Applies one steward's ruling. Internal order:
 *  1. L1AUTO escalation (isLap1 && !qualifying → penaltyPoints + 1)
 *  2. returnedPosition downgrade (effective warnings − 1, pp unchanged)
 *  3. Qualifying-incident branch (QualWarning; 2nd in season → qualBanIssued; early return)
 *  4. Warning → PP conversion (two warnings within |globalSeq diff| ≤ 1 → 1 pp)
 *  5. PP from ruling
 *  6. Consecutive-race bonus (prior non-bonus pp event within 1 race → +1 pp)
 *  7. Probation pp tracking (first 4 races back; ≥ 3 pp accrued → new season ban)
 *  8. Threshold checks, once per season (4→qual ban, 6→pit-lane, 8→race ban, 10→season ban)
 */
export function applyRuling(
  state: DriverLedgerState,
  ruling: Ruling,
): { state: DriverLedgerState; effects: RulingEffect } {
  let ppHistory = [...state.ppHistory];
  let raceWarnings = [...state.raceWarnings];
  let qualWarnings = [...state.qualWarnings];
  let pendingBans = [...state.pendingBans];
  let seasonAdministration = [...state.seasonAdministration];
  let seasonBan: SeasonBanState | null = state.seasonBan ? { ...state.seasonBan } : null;

  const newPpEvents: PpEvent[] = [];
  const bansIssued: PendingBan[] = [];
  let qualBanIssued = false;
  let warningConvertedToPp = false;

  // ── 1. L1AUTO escalation ─────────────────────────────────────────────────
  const ppFromRuling =
    ruling.isLap1 && !ruling.isQualifyingIncident
      ? ruling.penaltyPoints + 1
      : ruling.penaltyPoints;

  // ── 2. returnedPosition: remove one warning ──────────────────────────────
  const effectiveWarnings = ruling.returnedPosition
    ? Math.max(0, ruling.warnings - 1)
    : ruling.warnings;

  // ── 3. Qualifying track (separate from main PP track; early return) ──────
  if (ruling.isQualifyingIncident) {
    qualWarnings = [
      ...qualWarnings,
      { seasonId: ruling.raceRef.seasonId, raceIndex: ruling.raceRef.raceIndex },
    ];
    const seasonQuals = qualWarnings.filter((w) => w.seasonId === ruling.raceRef.seasonId);
    if (seasonQuals.length >= 2) {
      const ban: PendingBan = {
        type: 'qualifying_ban',
        issuedAtRace: ruling.raceRef,
        seasonId: ruling.raceRef.seasonId,
        racesMissedSinceIssued: 0,
        served: false,
      };
      pendingBans = [...pendingBans, ban];
      bansIssued.push(ban);
      qualBanIssued = true;
    }
    return {
      state: { ...state, qualWarnings, pendingBans },
      effects: {
        effectivePp: 0,
        ppBreakdown: [],
        bansIssued,
        qualBanIssued,
        warningConvertedToPp: false,
      },
    };
  }

  // ── 4. Warning → PP conversion ───────────────────────────────────────────
  if (effectiveWarnings > 0) {
    const newWarning = { raceRef: ruling.raceRef };
    const all = [...raceWarnings, newWarning];
    const sorted = [...all].sort((a, b) => a.raceRef.globalSeq - b.raceRef.globalSeq);
    const n = sorted.length;

    if (n >= 2 && sorted[n - 1].raceRef.globalSeq - sorted[n - 2].raceRef.globalSeq <= 1) {
      const consumed = new Set([sorted[n - 1], sorted[n - 2]]);
      raceWarnings = all.filter((w) => !consumed.has(w));
      const ev: PpEvent = { raceRef: ruling.raceRef, points: 1, reason: 'warning-conversion' };
      ppHistory = [...ppHistory, ev];
      newPpEvents.push(ev);
      warningConvertedToPp = true;
    } else {
      raceWarnings = all;
    }
  }

  // ── 5. PP from ruling ─────────────────────────────────────────────────────
  if (ppFromRuling > 0) {
    const ev: PpEvent = { raceRef: ruling.raceRef, points: ppFromRuling, reason: 'ruling' };
    ppHistory = [...ppHistory, ev];
    newPpEvents.push(ev);
  }

  // ── 6. Consecutive-race bonus ─────────────────────────────────────────────
  // Fires if this call added any non-bonus pp AND a prior non-bonus pp event
  // exists in state.ppHistory within 1 globalSeq of the current race.
  const addedSubstantivePp = newPpEvents.some(
    (e) => e.reason === 'ruling' || e.reason === 'warning-conversion',
  );
  if (addedSubstantivePp) {
    const seq = ruling.raceRef.globalSeq;
    const hasPrior = state.ppHistory
      .filter((e) => e.reason !== 'consecutive-bonus')
      .some((e) => seq - e.raceRef.globalSeq <= 1);
    if (hasPrior) {
      const ev: PpEvent = { raceRef: ruling.raceRef, points: 1, reason: 'consecutive-bonus' };
      ppHistory = [...ppHistory, ev];
      newPpEvents.push(ev);
    }
  }

  // ── 7. Probation pp tracking ──────────────────────────────────────────────
  if (seasonBan?.onProbation && seasonBan.probationRacesAttended < 4) {
    const addedPp = newPpEvents.reduce((s, e) => s + e.points, 0);
    seasonBan = { ...seasonBan, probationPpAccrued: seasonBan.probationPpAccrued + addedPp };
    if (seasonBan.probationPpAccrued >= 3) {
      seasonBan = {
        issuedAtRace: ruling.raceRef,
        bannedInFirstFourRaces: ruling.raceRef.raceIndex <= 4,
        racesAbsent: 0,
        active: true,
        onProbation: false,
        probationRacesAttended: 0,
        probationPpAccrued: 0,
      };
    }
  }

  // ── 8. Threshold checks (once per season) ────────────────────────────────
  const { seasonId } = ruling.raceRef;
  let admin: SeasonAdministration = seasonAdministration.find((a) => a.seasonId === seasonId) ?? {
    seasonId,
    qualifyingBanAdministered: false,
    pitLaneStartAdministered: false,
    raceBanAdministered: false,
    seasonBanAdministered: false,
  };

  const activePp = computeActivePp(ppHistory, ruling.raceRef);

  if (activePp >= 10 && !admin.seasonBanAdministered) {
    admin = { ...admin, seasonBanAdministered: true };
    seasonBan = {
      issuedAtRace: ruling.raceRef,
      bannedInFirstFourRaces: ruling.raceRef.raceIndex <= 4,
      racesAbsent: 0,
      active: true,
      onProbation: false,
      probationRacesAttended: 0,
      probationPpAccrued: 0,
    };
  }
  if (activePp >= 8 && !admin.raceBanAdministered) {
    admin = { ...admin, raceBanAdministered: true };
    const ban: PendingBan = {
      type: 'race_ban',
      issuedAtRace: ruling.raceRef,
      seasonId,
      racesMissedSinceIssued: 0,
      served: false,
    };
    pendingBans = [...pendingBans, ban];
    bansIssued.push(ban);
  }
  if (activePp >= 6 && !admin.pitLaneStartAdministered) {
    admin = { ...admin, pitLaneStartAdministered: true };
    const ban: PendingBan = {
      type: 'pit_lane_start',
      issuedAtRace: ruling.raceRef,
      seasonId,
      racesMissedSinceIssued: 0,
      served: false,
    };
    pendingBans = [...pendingBans, ban];
    bansIssued.push(ban);
  }
  if (activePp >= 4 && !admin.qualifyingBanAdministered) {
    admin = { ...admin, qualifyingBanAdministered: true };
    const ban: PendingBan = {
      type: 'qualifying_ban',
      issuedAtRace: ruling.raceRef,
      seasonId,
      racesMissedSinceIssued: 0,
      served: false,
    };
    pendingBans = [...pendingBans, ban];
    bansIssued.push(ban);
  }

  seasonAdministration = [
    ...seasonAdministration.filter((a) => a.seasonId !== seasonId),
    admin,
  ];

  return {
    state: { ...state, ppHistory, raceWarnings, pendingBans, seasonAdministration, seasonBan },
    effects: {
      effectivePp: newPpEvents.reduce((s, e) => s + e.points, 0),
      ppBreakdown: newPpEvents,
      bansIssued,
      qualBanIssued,
      warningConvertedToPp,
    },
  };
}

/**
 * Records driver attendance at a race.
 * - Drops pending bans from a prior season.
 * - Serves the first unserved PendingBan.
 * - If season-banned and return conditions are met, transitions to probation.
 * - Advances probationRacesAttended while on probation.
 */
export function recordAttendance(state: DriverLedgerState, raceRef: RaceRef): DriverLedgerState {
  // Drop bans from a prior season
  let pendingBans = state.pendingBans.filter((b) => b.seasonId === raceRef.seasonId);

  // Serve the first unserved ban
  let servedOne = false;
  pendingBans = pendingBans.map((b) => {
    if (!servedOne && !b.served) {
      servedOne = true;
      return { ...b, served: true };
    }
    return b;
  });

  let seasonBan: SeasonBanState | null = state.seasonBan ? { ...state.seasonBan } : null;

  // Check return conditions for an active season ban
  if (seasonBan?.active) {
    const activePp = computeActivePp(state.ppHistory, raceRef);
    const meetsAbsence = !seasonBan.bannedInFirstFourRaces || seasonBan.racesAbsent >= 2;
    if (activePp < 10 && meetsAbsence) {
      seasonBan = {
        ...seasonBan,
        active: false,
        onProbation: true,
        probationRacesAttended: 0,
      };
    }
  }

  // Advance probation counter (covers both just-returned and pre-existing probation)
  if (seasonBan !== null && !seasonBan.active && seasonBan.onProbation) {
    seasonBan = { ...seasonBan, probationRacesAttended: seasonBan.probationRacesAttended + 1 };
  }

  return { ...state, pendingBans, seasonBan };
}

/**
 * Records driver absence from a race.
 * - Drops pending bans from a prior season.
 * - Increments racesMissedSinceIssued on unserved bans; removes any that reach 2.
 * - Increments racesAbsent on an active season ban.
 */
export function recordAbsence(state: DriverLedgerState, raceRef: RaceRef): DriverLedgerState {
  // Drop bans from a prior season
  let pendingBans = state.pendingBans.filter((b) => b.seasonId === raceRef.seasonId);

  // Increment miss counter; clear unserved bans at 2 misses
  pendingBans = pendingBans
    .map((b) => (b.served ? b : { ...b, racesMissedSinceIssued: b.racesMissedSinceIssued + 1 }))
    .filter((b) => b.served || b.racesMissedSinceIssued < 2);

  let seasonBan: SeasonBanState | null = state.seasonBan ? { ...state.seasonBan } : null;

  if (seasonBan?.active) {
    seasonBan = { ...seasonBan, racesAbsent: seasonBan.racesAbsent + 1 };
  }

  return { ...state, pendingBans, seasonBan };
}

/**
 * Derives eligibility flags for the driver going into targetRace.
 * Call after recording attendance/absence for the preceding race.
 */
export function getEligibility(state: DriverLedgerState, targetRace: RaceRef): EligibilityStatus {
  const activePp = computeActivePp(state.ppHistory, targetRace);
  const activeBans = state.pendingBans.filter(
    (b) => !b.served && b.seasonId === targetRace.seasonId,
  );
  const isSeasonBanned = state.seasonBan?.active === true;

  return {
    driverId: state.driverId,
    targetRace,
    activePp,
    isSeasonBanned,
    isRaceBanned: activeBans.some((b) => b.type === 'race_ban'),
    mustStartFromPitLane: activeBans.some((b) => b.type === 'pit_lane_start'),
    hasQualifyingBan: activeBans.some((b) => b.type === 'qualifying_ban'),
    isOnProbation: !isSeasonBanned && state.seasonBan?.onProbation === true,
  };
}
