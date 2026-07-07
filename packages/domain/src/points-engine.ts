import type {
  CountbackEntry,
  DriverRoundResult,
  DriverRoundScore,
  DriverSeasonResult,
  TeamSeasonResult,
} from '@sra/shared-types';

// P1–P40 per the spec table; index 0 unused.
export const POSITION_POINTS: readonly number[] = [
  0,
  110, 100, 92, 85, 80, 76, 72, 68, 64, 60, // 1–10
  57,  54, 51, 48, 45, 43, 41, 39, 37, 35,  // 11–20
  33,  31, 29, 27, 25, 23, 21, 19, 17, 15,  // 21–30
  13,  11,  9,  7,  6,  5,  4,  3,  2,  1,  // 31–40
];

export const FASTEST_LAP_BONUS = 1;
export const BEST_QUAL_BONUS = 1;

// Maps a DriverRoundResult to a DriverRoundScore using the P1-P40 table + bonuses.
// A null position always yields positionPoints = 0.
export function computeDriverRoundScore(result: DriverRoundResult): DriverRoundScore {
  const positionPoints =
    result.position !== null ? (POSITION_POINTS[result.position] ?? 0) : 0;
  const fastestLapBonus = result.setFastestLap ? FASTEST_LAP_BONUS : 0;
  const bestQualBonus = result.setBestQualLap ? BEST_QUAL_BONUS : 0;
  return {
    driverId: result.driverId,
    roundIndex: result.roundIndex,
    position: result.position,
    positionPoints,
    fastestLapBonus,
    bestQualBonus,
    total: positionPoints + fastestLapBonus + bestQualBonus,
  };
}

// Best (N-1) of N rounds. Drops the single event with the lowest total.
// When two events tie for worst, drops the one with the higher roundIndex (most recent).
export function computeDriverSeasonTotal(
  driverId: string,
  roundScores: readonly DriverRoundScore[],
): DriverSeasonResult {
  if (roundScores.length === 0) {
    return { driverId, roundScores, droppedRoundIndex: -1, seasonTotal: 0 };
  }
  if (roundScores.length === 1) {
    // With a single round there is nothing to drop — keep the result.
    return { driverId, roundScores, droppedRoundIndex: -1, seasonTotal: roundScores[0].total };
  }

  // Sort ascending by total; tie-break: higher roundIndex first (that one gets dropped).
  const sorted = [...roundScores].sort((a, b) =>
    a.total !== b.total ? a.total - b.total : b.roundIndex - a.roundIndex,
  );
  const dropped = sorted[0];

  const seasonTotal = roundScores
    .filter((r) => r !== dropped)
    .reduce((sum, r) => sum + r.total, 0);

  return { driverId, roundScores, droppedRoundIndex: dropped.roundIndex, seasonTotal };
}

// team total = driverA.seasonTotal + driverB.seasonTotal.
// Calls computeDriverSeasonTotal internally — no separate team-drop logic.
export function computeTeamSeasonTotal(
  teamId: string,
  driverAScores: readonly DriverRoundScore[],
  driverBScores: readonly DriverRoundScore[],
): TeamSeasonResult {
  const driverA = computeDriverSeasonTotal(
    driverAScores[0]?.driverId ?? '',
    driverAScores,
  );
  const driverB = computeDriverSeasonTotal(
    driverBScores[0]?.driverId ?? '',
    driverBScores,
  );
  return { teamId, driverA, driverB, teamTotal: driverA.seasonTotal + driverB.seasonTotal };
}

// Standard countback comparator (use as a sort comparator).
// Compares: most P1s → most P2s → … → P40 → mostRecentRoundPosition → registrationOrder.
// Returns negative if a ranks higher, positive if b ranks higher, 0 if fully identical.
// Driver use: positions = all of one driver's round positions (including dropped round).
// Team use:   positions = pooled positions from both drivers across all rounds.
export function compareByCountback(a: CountbackEntry, b: CountbackEntry): number {
  const allFinishes = [...a.positions, ...b.positions].filter(
    (p): p is number => p !== null,
  );
  const maxPos = allFinishes.length > 0 ? Math.max(...allFinishes) : 0;

  for (let pos = 1; pos <= maxPos; pos++) {
    const aCount = a.positions.filter((p) => p === pos).length;
    const bCount = b.positions.filter((p) => p === pos).length;
    if (aCount !== bCount) return bCount - aCount; // more = better → negative when a leads
  }

  // OPEN: penultimate fallback — best finish in most-recent round (lower pos = better).
  const aRecent = a.mostRecentRoundPosition ?? Infinity;
  const bRecent = b.mostRecentRoundPosition ?? Infinity;
  if (aRecent !== bRecent) return aRecent - bRecent;

  // OPEN: final fallback — registration order (lower = registered earlier = higher rank).
  return a.registrationOrder - b.registrationOrder;
}
