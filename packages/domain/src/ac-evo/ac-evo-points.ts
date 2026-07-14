import type { AcEvoDriverResult, AcEvoSessionResult } from '@sra/shared-types';

// MX5 Cup scoring (league rule, distinct from the ACC P1-P40 engine in
// points-engine.ts). Index 0 unused; finishing positions 11+ score nothing.
export const ACEVO_POSITION_POINTS: readonly number[] = [
  0, 25, 18, 15, 12, 10, 8, 6, 4, 2, 1,
];
export const ACEVO_FASTEST_LAP_BONUS = 5;
export const ACEVO_POLE_BONUS = 5;

// Position points only — bonuses are computed separately (computePoleSteamId)
// since they come from a different session (Qualify) than this one (Race).
// fastestLapSteamId is whoever set the fastest *valid* lap within this race
// (AcEvoDriverResult.bestLapMs is already isValidLap-filtered by the parser).
export function computeRacePositionPoints(race: AcEvoSessionResult): {
  points: Record<string, number>;
  fastestLapSteamId: string | null;
} {
  const points: Record<string, number> = {};
  for (const r of race.results) {
    if (!r.steamId) continue;
    points[r.steamId] = (points[r.steamId] ?? 0) + (ACEVO_POSITION_POINTS[r.position] ?? 0);
  }

  const fastest = race.results.reduce<AcEvoDriverResult | null>((best: AcEvoDriverResult | null, r: AcEvoDriverResult) => {
    if (r.bestLapMs == null) return best;
    if (best == null || r.bestLapMs < best.bestLapMs!) return r;
    return best;
  }, null);

  return { points, fastestLapSteamId: fastest?.steamId || null };
}

// Pole = best qualifying lap. qualifyingBestMs is null for a driver who set
// no valid time, so they're naturally excluded.
export function computePoleSteamId(qualify: AcEvoSessionResult): string | null {
  const pole = qualify.results.reduce<AcEvoDriverResult | null>((best: AcEvoDriverResult | null, r: AcEvoDriverResult) => {
    if (r.qualifyingBestMs == null) return best;
    if (best == null || r.qualifyingBestMs < best.qualifyingBestMs!) return r;
    return best;
  }, null);
  return pole?.steamId || null;
}

// Merges position points with the fastest-lap and pole bonuses into one
// per-driver total for the round.
export function totalRoundPoints(
  racePositionPoints: Record<string, number>,
  fastestLapSteamId: string | null,
  poleSteamId: string | null,
): Record<string, number> {
  const total: Record<string, number> = { ...racePositionPoints };
  if (fastestLapSteamId) {
    total[fastestLapSteamId] = (total[fastestLapSteamId] ?? 0) + ACEVO_FASTEST_LAP_BONUS;
  }
  if (poleSteamId) {
    total[poleSteamId] = (total[poleSteamId] ?? 0) + ACEVO_POLE_BONUS;
  }
  return total;
}
