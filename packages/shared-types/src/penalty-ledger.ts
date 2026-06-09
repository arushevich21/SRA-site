/**
 * Stable reference to a scheduled race.
 * globalSeq is the sole ordering key for the 8-race rolling window;
 * it increments across season boundaries so no special cross-season
 * logic is needed when computing active PP.
 */
export type RaceRef = {
  seasonId: string;
  raceIndex: number;
  globalSeq: number;
};

/**
 * A steward's ruling on one incident.
 * penaltyPoints: base value before L1AUTO escalation (domain adds 1 if isLap1).
 * returnedPosition: removes one warning from the ruling; pp is unchanged.
 * isQualifyingIncident: routes to the separate qualifying-warning track (no pp).
 */
export type Ruling = {
  raceRef: RaceRef;
  driverId: string;
  penaltyPoints: number;
  warnings: number;
  isLap1: boolean;
  returnedPosition: boolean;
  isQualifyingIncident: boolean;
};

export type PpEvent = {
  raceRef: RaceRef;
  points: number;
  reason: 'ruling' | 'warning-conversion' | 'consecutive-bonus';
};

export type RaceWarning = {
  raceRef: RaceRef;
};

export type QualWarning = {
  seasonId: string;
  raceIndex: number;
};

/**
 * A threshold-triggered or qual-track ban awaiting service.
 * Pending bans (qualifying_ban / pit_lane_start / race_ban) do not roll
 * into the next season — cleared when seasonId no longer matches.
 * racesMissedSinceIssued reaches 2 → ban auto-clears without being served.
 */
export type PendingBan = {
  type: 'qualifying_ban' | 'pit_lane_start' | 'race_ban';
  issuedAtRace: RaceRef;
  seasonId: string;
  racesMissedSinceIssued: number;
  served: boolean;
};

export type SeasonAdministration = {
  seasonId: string;
  qualifyingBanAdministered: boolean;
  pitLaneStartAdministered: boolean;
  raceBanAdministered: boolean;
  seasonBanAdministered: boolean;
};

/**
 * Active season-ban state. Persists across season boundaries until resolved.
 * bannedInFirstFourRaces: raceIndex <= 4 at time of ban — requires
 * racesAbsent >= 2 AND pp < 10 to return (otherwise pp < 10 alone suffices).
 * Probation: accumulate 3 pp within first 4 races back → another season ban.
 */
export type SeasonBanState = {
  issuedAtRace: RaceRef;
  bannedInFirstFourRaces: boolean;
  racesAbsent: number;
  active: boolean;
  onProbation: boolean;
  probationRacesAttended: number;
  probationPpAccrued: number;
};

export type DriverLedgerState = {
  driverId: string;
  ppHistory: readonly PpEvent[];
  raceWarnings: readonly RaceWarning[];
  qualWarnings: readonly QualWarning[];
  pendingBans: readonly PendingBan[];
  seasonAdministration: readonly SeasonAdministration[];
  seasonBan: SeasonBanState | null;
};

export type RulingEffect = {
  effectivePp: number;
  ppBreakdown: readonly PpEvent[];
  bansIssued: readonly PendingBan[];
  qualBanIssued: boolean;
  warningConvertedToPp: boolean;
};

export type EligibilityStatus = {
  driverId: string;
  targetRace: RaceRef;
  activePp: number;
  isSeasonBanned: boolean;
  isRaceBanned: boolean;
  mustStartFromPitLane: boolean;
  hasQualifyingBan: boolean;
  isOnProbation: boolean;
};
