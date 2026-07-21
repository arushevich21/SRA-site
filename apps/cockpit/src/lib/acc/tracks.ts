import { msToLaptime } from '@sra/domain';
import type { AccHotLapEntry } from '@sra/shared-types';
import { supabase } from '../supabase';

export type AccTrack = {
  trackKey: string;
  displayName: string;
  splashArtUrl: string | null;
  country: string | null; // ISO 3166-1 alpha-2, e.g. 'de'
  location: string | null; // human-readable "place, country", e.g. "Nurburg, Germany"
};

export async function getAccTracks(): Promise<AccTrack[]> {
  const { data, error } = await supabase
    .from('acc_tracks')
    .select('track_key, display_name, splash_art_url, country, location')
    .order('display_name', { ascending: true });

  if (error) {
    console.error('ACC tracks lookup failed:', error);
    return [];
  }

  return (data ?? []).map((row) => ({
    trackKey: row.track_key as string,
    displayName: row.display_name as string,
    splashArtUrl: row.splash_art_url as string | null,
    country: row.country as string | null,
    location: row.location as string | null,
  }));
}

export async function getAccTrack(trackKey: string): Promise<AccTrack | null> {
  const { data, error } = await supabase
    .from('acc_tracks')
    .select('track_key, display_name, splash_art_url, country, location')
    .eq('track_key', trackKey)
    .maybeSingle();

  if (error) {
    console.error(`ACC track lookup failed for "${trackKey}":`, error);
    return null;
  }
  if (!data) return null;

  return {
    trackKey: data.track_key as string,
    displayName: data.display_name as string,
    splashArtUrl: data.splash_art_url as string | null,
    country: data.country as string | null,
    location: data.location as string | null,
  };
}

// Grouped by car_group (GT3/GT4/etc.) since ACC times aren't comparable
// across classes. rank isn't stored in the DB (see acc_hotlap_leaderboard
// schema) — it's derived here from the sorted position within each group.
export async function getAccTrackLeaderboard(
  trackKey: string,
): Promise<Record<string, AccHotLapEntry[]>> {
  const { data, error } = await supabase
    .from('acc_hotlap_leaderboard')
    .select('car_group, steam_id, driver_name, car_model, car_model_id, best_lap_ms, sectors_ms')
    .eq('track_key', trackKey)
    .order('car_group', { ascending: true })
    .order('best_lap_ms', { ascending: true });

  if (error) {
    console.error(`ACC hot-lap leaderboard lookup failed for "${trackKey}":`, error);
    return {};
  }

  const byCarGroup: Record<string, AccHotLapEntry[]> = {};
  for (const row of data ?? []) {
    const carGroup = row.car_group as string;
    const entries = byCarGroup[carGroup] ?? (byCarGroup[carGroup] = []);
    const bestLapMs = row.best_lap_ms as number;
    entries.push({
      rank: entries.length + 1,
      steamId: row.steam_id as string,
      driverName: row.driver_name as string,
      carGroup,
      carModel: row.car_model_id as number | null,
      carModelName: row.car_model as string | null,
      bestLapMs,
      bestLap: msToLaptime(bestLapMs)!,
      sectorsMs: row.sectors_ms as number[] | null,
    });
  }
  return byCarGroup;
}

// Outright fastest N times at this track across every car_group combined —
// for the track-list summary card. Per-class breakdown lives on the track's
// own detail page (getAccTrackLeaderboard above).
export async function getAccTrackTopTimes(
  trackKey: string,
  limit = 3,
): Promise<AccHotLapEntry[]> {
  const { data, error } = await supabase
    .from('acc_hotlap_leaderboard')
    .select('car_group, steam_id, driver_name, car_model, car_model_id, best_lap_ms, sectors_ms')
    .eq('track_key', trackKey)
    .order('best_lap_ms', { ascending: true })
    .limit(limit);

  if (error) {
    console.error(`ACC top-times lookup failed for "${trackKey}":`, error);
    return [];
  }

  return (data ?? []).map((row, i) => {
    const bestLapMs = row.best_lap_ms as number;
    return {
      rank: i + 1,
      steamId: row.steam_id as string,
      driverName: row.driver_name as string,
      carGroup: row.car_group as string,
      carModel: row.car_model_id as number | null,
      carModelName: row.car_model as string | null,
      bestLapMs,
      bestLap: msToLaptime(bestLapMs)!,
      sectorsMs: row.sectors_ms as number[] | null,
    };
  });
}

export type AccTrackStats = {
  entriesCount: number;
  lastUpdated: string | null; // ISO timestamp of the most recently updated row, if any
};

// entriesCount = number of driver rows recorded at this track (across all
// classes) — a proxy for "entries", not a distinct count of raw sessions.
// lastUpdated = most recent updated_at across those rows.
export async function getAccTrackStats(trackKey: string): Promise<AccTrackStats> {
  const [countRes, latestRes] = await Promise.all([
    supabase
      .from('acc_hotlap_leaderboard')
      .select('*', { count: 'exact', head: true })
      .eq('track_key', trackKey),
    supabase
      .from('acc_hotlap_leaderboard')
      .select('updated_at')
      .eq('track_key', trackKey)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (countRes.error) {
    console.error(`ACC entries-count lookup failed for "${trackKey}":`, countRes.error);
  }
  if (latestRes.error) {
    console.error(`ACC last-updated lookup failed for "${trackKey}":`, latestRes.error);
  }

  return {
    entriesCount: countRes.count ?? 0,
    lastUpdated: (latestRes.data?.updated_at as string | undefined) ?? null,
  };
}
