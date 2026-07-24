import 'server-only';
import type { AccHotLapEntry } from '@sra/shared-types';
import type { ChampionshipContent } from '@/content/championships';
import { getChampionships } from './championships-store';
import { accTrackKeyForDisplay } from '@/content/sim-catalog';
import { getAccTrackLeaderboard } from './acc/tracks';

// Endurance championships (formatTag "Endurance") feed the Hot Lap (Endurance)
// board; every other ACC championship feeds Hot Lap (Seasonal). Same per-round
// release toggle, routed by championship type.
export function isEnduranceChampionship(c: ChampionshipContent): boolean {
  return (c.formatTag ?? '').trim().toLowerCase() === 'endurance';
}

// The Seasonal hot-lap leaderboard: admin-released, per-round boards for the ACC
// (accsm1-7) championships. A round is shown only when its hotlap_released flag
// is set — that admin toggle IS the "is it live" gate (unreleased/upcoming
// rounds stay hidden by default). Scoped to ACC because only accsm1-7
// championships feed acc_hotlap_leaderboard.

export type SeasonalRoundBoard = {
  round: number;
  trackDisplay: string;
  trackKey: string;
  leaderboardByCarGroup: Record<string, AccHotLapEntry[]>;
};

export type SeasonalChampBoards = {
  slug: string;
  title: string;
  rounds: SeasonalRoundBoard[];
};

// Cheap checks for tab/nav visibility — no hot-lap queries, just the flags.
export async function hasSeasonalReleased(): Promise<boolean> {
  const champs = await getChampionships();
  return champs.some(
    (c) =>
      c.game === 'ACC' &&
      !isEnduranceChampionship(c) &&
      c.schedule.some((r) => r.hotlapReleased),
  );
}

export async function hasEnduranceReleased(): Promise<boolean> {
  const champs = await getChampionships();
  return champs.some(
    (c) =>
      c.game === 'ACC' &&
      isEnduranceChampionship(c) &&
      c.schedule.some((r) => r.hotlapReleased),
  );
}

// Full released boards, grouped by championship, for the Seasonal page.
// Endurance championships are excluded — they belong to Hot Lap (Endurance).
export async function getSeasonalBoards(): Promise<SeasonalChampBoards[]> {
  const champs = (await getChampionships()).filter(
    (c) => c.game === 'ACC' && !isEnduranceChampionship(c),
  );
  const out: SeasonalChampBoards[] = [];

  for (const champ of champs) {
    const released = champ.schedule.filter((r) => r.hotlapReleased);
    if (released.length === 0) continue;

    const rounds: SeasonalRoundBoard[] = [];
    for (const r of released) {
      const trackKey = accTrackKeyForDisplay(r.track);
      if (!trackKey) continue; // custom/unmapped track — no board to pull
      rounds.push({
        round: r.round,
        trackDisplay: r.track,
        trackKey,
        leaderboardByCarGroup: await getAccTrackLeaderboard(trackKey),
      });
    }

    if (rounds.length > 0) out.push({ slug: champ.slug, title: champ.title, rounds });
  }

  return out;
}
