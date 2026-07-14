import type { AccSessionResult } from '@sra/shared-types';
import {
  computeDriverRoundScore,
  POSITION_POINTS,
  FASTEST_LAP_BONUS,
  BEST_QUAL_BONUS,
} from '../points-engine.js';

// ACC round scoring — mirrors ac-evo-points.ts's shape (small composable
// functions, Record<string, number> keyed by steamId, plus exported point
// constants), but unlike MX5 Cup, ACC doesn't need its own points table: it's
// the P1-P40 table + fastest-lap bonuses already in points-engine.ts (see the
// "distinct from the ACC P1-P40 engine" comment in ac-evo-points.ts — that
// engine *is* this one). These are re-exports/aliases, not new constants, so
// the actual point values still live in exactly one place.
export const ACC_POSITION_POINTS = POSITION_POINTS;
export const ACC_FASTEST_RACE_LAP_BONUS = FASTEST_LAP_BONUS;
export const ACC_FASTEST_QUALIFYING_LAP_BONUS = BEST_QUAL_BONUS;

// Finds whoever set the fastest valid lap in a completed session (Race or
// Qualify). bestLapMs on each AccDriverResult is already ACC's own resolved
// best lap (see acc-parser.ts) — no re-validation needed here. Attribution is
// to currentDriverSteamId (whoever was driving when the session ended); for a
// multi-driver car this means a co-driver's fastest lap can't be credited to
// them individually from this data alone.
function fastestLapSteamId(session: AccSessionResult): string | null {
  let bestSteamId: string | null = null;
  let bestMs: number | null = null;
  for (const r of session.results) {
    const steamId = r.currentDriverSteamId;
    if (!steamId || r.bestLapMs == null) continue;
    if (bestMs == null || r.bestLapMs < bestMs) {
      bestMs = r.bestLapMs;
      bestSteamId = steamId;
    }
  }
  return bestSteamId;
}

// Position points (P1-P40) + Fastest Race Lap bonus — both come from this one
// Race session. The Fastest Qualifying Lap bonus is computed separately
// (computeAccFastestQualifyingLapSteamId) since it comes from a different
// session (Qualify) than this one.
export function computeAccRacePoints(race: AccSessionResult): {
  points: Record<string, number>;
  fastestRaceLapSteamId: string | null;
} {
  const fastestRaceLapSteamId = fastestLapSteamId(race);
  const points: Record<string, number> = {};

  for (const r of race.results) {
    const steamId = r.currentDriverSteamId;
    if (!steamId) continue;
    const score = computeDriverRoundScore({
      driverId: steamId,
      roundIndex: 0, // unused here — only positionPoints/fastestLapBonus are read
      position: r.position,
      setFastestLap: steamId === fastestRaceLapSteamId,
      setBestQualLap: false, // Fastest Qualifying Lap bonus applied later, in totalAccRoundPoints
    });
    points[steamId] = (points[steamId] ?? 0) + score.positionPoints + score.fastestLapBonus;
  }

  return { points, fastestRaceLapSteamId };
}

// Fastest Qualifying Lap = whoever set the outright fastest lap in Qualify
// (not necessarily P1 — leaderBoardLines order can reflect other
// tiebreakers; this looks at bestLapMs directly).
export function computeAccFastestQualifyingLapSteamId(qualify: AccSessionResult): string | null {
  return fastestLapSteamId(qualify);
}

// Merges race points (position + Fastest Race Lap bonus, already included by
// computeAccRacePoints) with the Fastest Qualifying Lap bonus into one
// per-driver total for the round. The bonus amount itself comes from
// points-engine.ts's computeDriverRoundScore (setBestQualLap: true) rather
// than a literal repeated here.
export function totalAccRoundPoints(
  racePoints: Record<string, number>,
  fastestQualifyingLapSteamId: string | null,
): Record<string, number> {
  const total: Record<string, number> = { ...racePoints };
  if (fastestQualifyingLapSteamId) {
    const { bestQualBonus } = computeDriverRoundScore({
      driverId: fastestQualifyingLapSteamId,
      roundIndex: 0,
      position: null,
      setFastestLap: false,
      setBestQualLap: true,
    });
    total[fastestQualifyingLapSteamId] = (total[fastestQualifyingLapSteamId] ?? 0) + bestQualBonus;
  }
  return total;
}
