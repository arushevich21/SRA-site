export type DriverRoundResult = {
  driverId: string;
  roundIndex: number;       // 0-based; used for most-recent-round tiebreaker
  position: number | null;  // null = not classified → 0 position points
  setFastestLap: boolean;
  setBestQualLap: boolean;
};

export type DriverRoundScore = {
  driverId: string;
  roundIndex: number;
  position: number | null;
  positionPoints: number;
  fastestLapBonus: number;  // 0 or 1
  bestQualBonus: number;    // 0 or 1
  total: number;            // positionPoints + fastestLapBonus + bestQualBonus
};

export type DriverSeasonResult = {
  driverId: string;
  roundScores: readonly DriverRoundScore[];
  droppedRoundIndex: number;  // roundIndex of the dropped event; -1 if no rounds
  seasonTotal: number;
};

export type TeamSeasonResult = {
  teamId: string;
  driverA: DriverSeasonResult;
  driverB: DriverSeasonResult;
  teamTotal: number;  // driverA.seasonTotal + driverB.seasonTotal
};

// Input to compareByCountback.
// OPEN (non-blocking): mostRecentRoundPosition and registrationOrder are the spec's
// ultimate-tie defaults. Change either field to swap the tiebreaker rule.
export type CountbackEntry = {
  positions: readonly (number | null)[];  // all rounds, including dropped round
  mostRecentRoundPosition: number | null; // penultimate fallback: best finish in last round
  registrationOrder: number;              // final fallback: lower = registered earlier
};
