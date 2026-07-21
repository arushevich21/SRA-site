import { CHAMPIONSHIPS } from '@/content/championships';
import { trackSlug } from './track-slug';

export type LeaderboardTrack = {
  slug: string;
  displayName: string; // e.g. "COTA National" — round.track, kept for display
  rawTrackName: string; // e.g. "Circuit Of The Americas" — the hot-lap cache key
};

// Every distinct track a sim's championships have run on Emperor, deduped by
// raw track name (a track can appear across multiple rounds/championships).
export function getLeaderboardTracks(game: string): LeaderboardTrack[] {
  const seen = new Map<string, LeaderboardTrack>();
  for (const champ of CHAMPIONSHIPS) {
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

export function findLeaderboardTrack(game: string, slug: string): LeaderboardTrack | undefined {
  return getLeaderboardTracks(game).find((t) => t.slug === slug);
}
