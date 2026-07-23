import { getChampionships } from './championships-store';
import { trackSlug } from './track-slug';

export type LeaderboardTrack = {
  slug: string;
  displayName: string; // e.g. "COTA National" — round.track, kept for display
  rawTrackName: string; // e.g. "Circuit Of The Americas" — the hot-lap cache key
};

// Every distinct track a sim's championships have run on Emperor, deduped by
// raw track name (a track can appear across multiple rounds/championships).
export async function getLeaderboardTracks(game: string): Promise<LeaderboardTrack[]> {
  const championships = await getChampionships();
  const seen = new Map<string, LeaderboardTrack>();
  for (const champ of championships) {
    if (champ.game !== game) continue;
    for (const round of champ.schedule) {
      if (!round.emperorRawTrackName || seen.has(round.emperorRawTrackName)) continue;
      seen.set(round.emperorRawTrackName, {
        slug: trackSlug(round.emperorRawTrackName),
        displayName: round.track,
        rawTrackName: round.emperorRawTrackName,
      });
    }
  }
  return [...seen.values()];
}

export async function findLeaderboardTrack(
  game: string,
  slug: string,
): Promise<LeaderboardTrack | undefined> {
  return (await getLeaderboardTracks(game)).find((t) => t.slug === slug);
}
