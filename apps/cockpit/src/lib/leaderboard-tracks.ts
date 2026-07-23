import { CHAMPIONSHIPS } from '@/content/championships';
import { trackSlug } from './track-slug';
import { getHotLapBoard } from './acevo-hotlaps';
import { supabase } from './supabase';
import type { TrackSummary, TrackTopEntry } from './track-summary';
import type { TrackWithTopTimes } from '@/components/TrackList';

export type LeaderboardTrack = {
  slug: string;
  displayName: string; // e.g. "COTA National" — round.track, kept for display
  rawTrackName: string; // e.g. "Circuit Of The Americas" — the hot-lap cache key
  emperorTrack?: string; // "TrackName,Layout" — see parseEmperorTrackLayout in track-slug.ts
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
        emperorTrack: round.emperorTrack,
      });
    }
  }
  return [...seen.values()];
}

export function findLeaderboardTrack(game: string, slug: string): LeaderboardTrack | undefined {
  return getLeaderboardTracks(game).find((t) => t.slug === slug);
}

// AC Evo has no numeric car-ID scheme like ACC — carModel is just a plain
// display string. Every MX5 Cup car is "Mazda MX-5 ND Cup", so a simple
// substring match is enough (unlike ACC, there's no ambiguity to resolve).
export function acEvoManufacturerIconName(carModel: string | null): string | null {
  if (!carModel) return null;
  return /mazda/i.test(carModel) ? 'MazdaIcon' : null;
}

// Adapters into the sim-neutral shapes TrackList/TrackHeader consume.
export function toTrackTopEntry(entry: {
  rank: number;
  steamId: string;
  driverName: string;
  carModel: string | null;
  bestLap: string;
}): TrackTopEntry {
  return {
    rank: entry.rank,
    steamId: entry.steamId,
    driverName: entry.driverName,
    carLabel: entry.carModel,
    manufacturerIconName: acEvoManufacturerIconName(entry.carModel),
    manufacturerLogoUrl: null,
    bestLap: entry.bestLap,
  };
}

// Enriches with real splash art / country / location from the shared tracks
// table (see supabase/migrations/20260722_shared_tracks_and_acevo_v2_cache.sql)
// — e.g. AC Evo racing at the same physical place ACC already has curated,
// Nurburgring. Falls back to nulls wherever nothing has been curated yet.
//
// mapUrl is intentionally always null here — track maps are an ACC-only
// feature for now (see lib/acc/tracks.ts's toTrackSummary for where it's
// actually populated).
export async function toTrackSummary(track: LeaderboardTrack): Promise<TrackSummary> {
  const baseTrackKey = trackSlug(track.rawTrackName);
  const { data, error } = await supabase
    .from('tracks')
    .select('splash_art_url, country, location')
    .eq('base_track_key', baseTrackKey)
    .maybeSingle();

  if (error) {
    console.error(`Track metadata lookup failed for "${baseTrackKey}":`, error);
  }

  return {
    trackKey: track.slug,
    displayName: track.displayName,
    splashArtUrl: data?.splash_art_url ?? null,
    country: data?.country ?? null,
    location: data?.location ?? null,
    mapUrl: null,
  };
}

// Used by the leaderboards list page — one getHotLapBoard call per track,
// just to preview the top N. The track detail page fetches the full board
// itself (needed for HotLapBoard anyway) and derives the fastest lap from
// that instead of calling this a second time.
export async function getLeaderboardTracksWithTopTimes(
  game: string,
  limit = 3,
): Promise<TrackWithTopTimes[]> {
  const tracks = getLeaderboardTracks(game);
  return Promise.all(
    tracks.map(async (track) => {
      const [entries, summary] = await Promise.all([
        getHotLapBoard(track.rawTrackName, track.emperorTrack),
        toTrackSummary(track),
      ]);
      return {
        ...summary,
        topTimes: entries.slice(0, limit).map(toTrackTopEntry),
      };
    }),
  );
}
