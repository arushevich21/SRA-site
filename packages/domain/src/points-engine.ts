import type {
  CountbackEntry,
  DriverRoundResult,
  DriverRoundScore,
  DriverSeasonResult,
  TeamSeasonResult,
} from '@sra/shared-types';

// Maps a DriverRoundResult to a DriverRoundScore using the P1-P40 table + bonuses.
// A null position always yields positionPoints = 0.
export function computeDriverRoundScore(_result: DriverRoundResult): DriverRoundScore {
  throw new Error('not implemented');
}

// Best (N-1) of N rounds. Drops the single event with the lowest total.
// When two events tie for worst, drops the one with the higher roundIndex (most recent).
export function computeDriverSeasonTotal(
  _driverId: string,
  _roundScores: readonly DriverRoundScore[],
): DriverSeasonResult {
  throw new Error('not implemented');
}

// team total = driverA.seasonTotal + driverB.seasonTotal.
// Calls computeDriverSeasonTotal internally — no separate team-drop logic.
export function computeTeamSeasonTotal(
  _teamId: string,
  _driverAScores: readonly DriverRoundScore[],
  _driverBScores: readonly DriverRoundScore[],
): TeamSeasonResult {
  throw new Error('not implemented');
}

// Standard countback comparator (use as a sort comparator).
// Compares: most P1s → most P2s → … → P40 → mostRecentRoundPosition → registrationOrder.
// Returns negative if a ranks higher, positive if b ranks higher, 0 if fully identical.
// Driver use: positions = all of one driver's round positions (including dropped round).
// Team use:   positions = pooled positions from both drivers across all rounds.
export function compareByCountback(_a: CountbackEntry, _b: CountbackEntry): number {
  throw new Error('not implemented');
}
