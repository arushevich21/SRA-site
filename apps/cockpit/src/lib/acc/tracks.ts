import { unstable_cache } from 'next/cache';
import {
  msToLaptime,
  accCarClassName,
  accCarManufacturerIconName,
  accCarManufacturerLogoUrl,
} from '@sra/domain';
import type { AccHotLapEntry } from '@sra/shared-types';
import type { TrackSummary, TrackTopEntry } from '../track-summary';
import { supabase } from '../supabase';
import { applySeasonFilter } from './seasons';
import { getDriverInfoBySteamIds, driverInfoFor, stripSteamIdPrefix, type DriverInfo } from '../driver-lookup';
import { classifyLapTier, type LapTier } from './reference-times';
import { LEADERBOARD_PAGE_SIZE, carModelIdsForClass } from './leaderboard-constants';

export { ACC_CLASSES, LEADERBOARD_PAGE_SIZE, carModelIdsForClass } from './leaderboard-constants';

// AccHotLapEntry enriched with the driver's registered SRA number/nationality
// (see lib/driver-lookup.ts) and its reference-time tier (see
// lib/acc/reference-times.ts) — the app-layer read functions below populate
// these from the drivers table and the curated GT3 reference times; the pure
// aggregateAccHotLapLeaderboard in packages/domain (which also builds
// AccHotLapEntry, from parsed sessions, with no DB/content access) never sees
// them, so AccHotLapEntry itself stays a pure data-contract type. lapTier is
// null for a non-GT3 car or a wet lap (no reference data for either).
export type EnrichedAccHotLapEntry = AccHotLapEntry & DriverInfo & { lapTier: LapTier | null };

export type AccTrack = {
  trackKey: string;
  displayName: string;
  splashArtUrl: string | null;
  country: string | null; // ISO 3166-1 alpha-2, e.g. 'de'
  location: string | null; // human-readable "place, country", e.g. "Nurburg, Germany"
  mapUrl: string | null; // track_layouts.map_url — curated, null until set
};

// Track metadata is sourced from acc_tracks — the table the ingest actually
// maintains, with a row and a working splash-art URL for every track that has
// lap data (25+). An earlier cutover pointed these reads at the shared
// track_layouts table, but that migration only backfilled 7 ACC tracks and
// populated image URLs that 404 — so most tracks vanished from the list and
// the few that showed had broken art. We keep track_layouts solely for its
// curated display names (nicer than acc_tracks' raw placeholder for a handful
// of tracks), overlaid on top.
type AccTrackRow = {
  track_key: string;
  display_name: string;
  splash_art_url: string | null;
  country: string | null;
  location: string | null;
};

// track_key -> curated display name, for the few tracks named in track_layouts.
// Small (a handful of rows); used only to prettify names.
async function getCuratedTrackNames(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('track_layouts')
    .select('layout_key, display_name')
    .eq('game', 'ACC');
  if (error) {
    console.error('ACC curated track-name lookup failed:', error);
    return new Map();
  }
  return new Map((data ?? []).map((r) => [r.layout_key as string, r.display_name as string]));
}

// The track preview PHOTOS (photo_*.jpg) were lost when the old website's
// static host was taken down — they 404 now and aren't coming back on their
// own, so there's no background image. What survives on the CDN is the track
// MAP graphic (map_*.png), which acc_tracks.splash_art_url currently holds; we
// render it in the card's centered map slot (mapUrl), not as a stretched
// background. Leaving splashArtUrl null until real photos are re-hosted.
function toAccTrack(row: AccTrackRow, curatedNames: Map<string, string>): AccTrack {
  return {
    trackKey: row.track_key,
    displayName: curatedNames.get(row.track_key) ?? row.display_name,
    splashArtUrl: null,
    country: row.country ?? null,
    location: row.location ?? null,
    mapUrl: row.splash_art_url ?? null,
  };
}

export async function getAccTracks(): Promise<AccTrack[]> {
  const [{ data, error }, curatedNames] = await Promise.all([
    supabase.from('acc_tracks').select('track_key, display_name, splash_art_url, country, location'),
    getCuratedTrackNames(),
  ]);

  if (error) {
    console.error('ACC tracks lookup failed:', error);
    return [];
  }

  return ((data ?? []) as AccTrackRow[])
    .map((row) => toAccTrack(row, curatedNames))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function getAccTrack(trackKey: string): Promise<AccTrack | null> {
  const [{ data, error }, curatedNames] = await Promise.all([
    supabase
      .from('acc_tracks')
      .select('track_key, display_name, splash_art_url, country, location')
      .eq('track_key', trackKey)
      .maybeSingle(),
    getCuratedTrackNames(),
  ]);

  if (error) {
    console.error(`ACC track lookup failed for "${trackKey}":`, error);
    return null;
  }
  if (!data) return null;

  return toAccTrack(data as AccTrackRow, curatedNames);
}

// Class (GT3/GT4/TCX/etc.) is never stored on acc_hotlap_leaderboard — it's
// a pure function of car_model_id (see accCarClassName in
// packages/domain/src/acc/acc-constants.ts), derived fresh here rather than
// trusted from a persisted column, so a future correction to that lookup
// table takes effect immediately with no stale data anywhere to reconcile.
export function resolveCarGroup(carModelId: number | null): string {
  return (carModelId != null ? accCarClassName(carModelId) : null) ?? 'Other';
}

// A single "board" is one combination of board_scope + season (see
// acc_hotlap_leaderboard's composite PK in
// supabase/migrations/20260725b_acc_hotlap_drop_car_group.sql). The table
// holds many boards per track; a query that pins only track_key silently
// merges them and takes the fastest lap across every board — mixing seasons
// together. Every read MUST pin both dimensions or it reports a "best" that
// doesn't belong to the board being shown.
//
// is_wet is NOT filtered on: wet and dry laps appear together on the same
// board, each driver's fastest time in a car winning regardless of
// conditions (a wet lap only surfaces if it's their only time in that car —
// see the dedup loops below).
export type AccBoard = {
  scope: 'persistent' | 'seasonal';
  season: string; // '' for the persistent board; e.g. 'S19' for a seasonal one
};

// The all-time board — what the public track pages show (persistent scope
// holds the backfilled all-time bests, season='' by the migration's backfill
// default).
export const PERSISTENT_DRY: AccBoard = { scope: 'persistent', season: '' };

// ACC_CLASSES, LEADERBOARD_PAGE_SIZE, and carModelIdsForClass live in
// ./leaderboard-constants (imported/re-exported above) — split out because
// AccTrackLeaderboard ('use client') needs them too, and importing them from
// this file directly would pull its server-only supabase client into the
// client bundle.

export type PaginatedLeaderboard<T> = {
  entries: T[];
  totalCount: number;
  page: number;
  pageSize: number;
};

// Grouped by class since ACC times aren't comparable across classes — but
// only within ONE page/class query at a time now, not across the whole
// board. rank is the row's position in the full sorted (server-side) result,
// not just within this page, so page 2's first entry correctly shows as rank
// 301 rather than restarting at 1. One accuracy trade-off from paginating at
// the query level rather than fetching everything first: dedup (a driver's
// wet lap only shows if they have no dry lap in that car — see below) can
// only see rows within the current page, so rank near a page boundary can be
// off by however many duplicate rows fall on that page. Narrow edge case —
// only matters for a driver with both a wet and dry lap in the same car,
// split across a page boundary — accepted for now; the fully correct fix is
// a DB-side DISTINCT ON view that dedups before pagination.
// Internal implementation, cached below — kept as a plain function (not
// exported) so unstable_cache wraps a stable, pure-in-its-arguments target.
// page/classFilter are pre-normalized by the exported wrapper so e.g.
// `opts.page` omitted and `opts.page: 1` hash to the same cache entry.
async function fetchAccTrackLeaderboard(
  trackKey: string,
  board: AccBoard,
  page: number,
  classFilter: string | null,
): Promise<PaginatedLeaderboard<EnrichedAccHotLapEntry>> {
  const from = (page - 1) * LEADERBOARD_PAGE_SIZE;
  const to = from + LEADERBOARD_PAGE_SIZE - 1;

  const base = applySeasonFilter(
    supabase
      .from('acc_hotlap_leaderboard')
      .select('steam_id, driver_name, car_model, car_model_id, best_lap_ms, sectors_ms, is_wet', {
        count: 'exact',
      })
      .eq('track_key', trackKey)
      .eq('board_scope', board.scope),
    board.season,
  );
  const filtered = classFilter ? base.in('car_model_id', carModelIdsForClass(classFilter)) : base;

  const { data, error, count } = await filtered
    .order('best_lap_ms', { ascending: true })
    .range(from, to);

  if (error) {
    console.error(`ACC hot-lap leaderboard lookup failed for "${trackKey}":`, error);
    return { entries: [], totalCount: 0, page, pageSize: LEADERBOARD_PAGE_SIZE };
  }

  const rows = data ?? [];
  const driverInfo = await getDriverInfoBySteamIds(
    rows.map((row) => stripSteamIdPrefix(row.steam_id as string)),
  );

  // Wet and dry laps share one dedup key (steam_id, car_model_id) — rows
  // arrive best-first, so a driver's fastest lap in a car wins regardless of
  // conditions, and a merged season's (S14 = S14 + S14-2) duplicate half is
  // dropped the same way. A wet lap only surfaces if it's the only lap that
  // driver has in that car. Only dedups within this page — see the function
  // comment above.
  const seen = new Set<string>();
  const entries: EnrichedAccHotLapEntry[] = [];
  for (const row of rows) {
    const carModelId = row.car_model_id as number | null;
    const dedupKey = `${row.steam_id}:${carModelId}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    const carGroup = resolveCarGroup(carModelId);
    const bestLapMs = row.best_lap_ms as number;
    entries.push({
      rank: from + entries.length + 1,
      steamId: row.steam_id as string,
      driverName: row.driver_name as string,
      carGroup,
      carModel: carModelId,
      carModelName: row.car_model as string | null,
      bestLapMs,
      bestLap: msToLaptime(bestLapMs)!,
      sectorsMs: row.sectors_ms as number[] | null,
      isWetSession: row.is_wet as boolean,
      ...driverInfoFor(driverInfo, stripSteamIdPrefix(row.steam_id as string)),
      // Reference times are GT3-only and dry-only — a wet lap still shows on
      // the board, just without a tier badge.
      lapTier: carGroup === 'GT3' && !row.is_wet ? classifyLapTier(bestLapMs, trackKey, 'lap') : null,
    });
  }
  return { entries, totalCount: count ?? 0, page, pageSize: LEADERBOARD_PAGE_SIZE };
}

// Cached entry point — one unstable_cache hit covers BOTH the page's initial
// SSR render and every page/class switch from AccTrackLeaderboard's Server
// Action (fetchAccLeaderboardPage in [sim]/leaderboards/actions.ts), since
// both call this same function. Route-level ISR alone wouldn't cover the
// Server Action path — Server Actions always execute live, so caching had to
// move to the data-fetch level to actually cut Supabase calls on page/class
// switches, not just on first paint.
//
// revalidate: 300s is a safety-net ceiling, not the expected staleness — the
// ACC hotlap cron (refresh-acc-leaderboard) calls revalidateTag for exactly
// the tracks it touched right after writing, so real staleness is bounded by
// the cron's own cadence (~10min) rather than this window, except if a
// revalidateTag call is ever missed.
export function getAccTrackLeaderboard(
  trackKey: string,
  board: AccBoard = PERSISTENT_DRY,
  opts: { page?: number; classFilter?: string } = {},
): Promise<PaginatedLeaderboard<EnrichedAccHotLapEntry>> {
  const page = Math.max(1, opts.page ?? 1);
  const classFilter = opts.classFilter ?? null;
  return unstable_cache(fetchAccTrackLeaderboard, ['acc-hotlap-leaderboard'], {
    revalidate: 300,
    tags: [`acc-hotlap:${trackKey}`],
  })(trackKey, board, page, classFilter);
}

// Outright fastest N times at this track across every class combined — for
// the track-list summary card. Per-class breakdown lives on the track's own
// detail page (getAccTrackLeaderboard above).
export async function getAccTrackTopTimes(
  trackKey: string,
  limit = 3,
  board: AccBoard = PERSISTENT_DRY,
): Promise<EnrichedAccHotLapEntry[]> {
  // Over-fetch so that, after collapsing a merged season's (driver, car)
  // duplicates (see getAccTrackLeaderboard), we still have `limit` unique
  // entries to show. Harmless for unmerged boards (no dupes to drop).
  const { data, error } = await applySeasonFilter(
    supabase
      .from('acc_hotlap_leaderboard')
      .select('steam_id, driver_name, car_model, car_model_id, best_lap_ms, sectors_ms, is_wet')
      .eq('track_key', trackKey)
      .eq('board_scope', board.scope),
    board.season,
  )
    .order('best_lap_ms', { ascending: true })
    .limit(limit * 2 + 6);

  if (error) {
    console.error(`ACC top-times lookup failed for "${trackKey}":`, error);
    return [];
  }

  const rows = data ?? [];
  const driverInfo = await getDriverInfoBySteamIds(
    rows.map((row) => stripSteamIdPrefix(row.steam_id as string)),
  );

  const seen = new Set<string>();
  const out: EnrichedAccHotLapEntry[] = [];
  for (const row of rows) {
    const carModelId = row.car_model_id as number | null;
    const dedupKey = `${row.steam_id}:${carModelId}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    const bestLapMs = row.best_lap_ms as number;
    const carGroup = resolveCarGroup(carModelId);
    out.push({
      rank: out.length + 1,
      steamId: row.steam_id as string,
      driverName: row.driver_name as string,
      carGroup,
      carModel: carModelId,
      carModelName: row.car_model as string | null,
      bestLapMs,
      bestLap: msToLaptime(bestLapMs)!,
      sectorsMs: row.sectors_ms as number[] | null,
      isWetSession: row.is_wet as boolean,
      ...driverInfoFor(driverInfo, stripSteamIdPrefix(row.steam_id as string)),
      lapTier: carGroup === 'GT3' && !row.is_wet ? classifyLapTier(bestLapMs, trackKey, 'lap') : null,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export type AccTrackStats = {
  entriesCount: number;
  lastUpdated: string | null; // ISO timestamp of the most recently updated row, if any
};

// entriesCount = number of driver rows recorded at this track (across all
// classes) — a proxy for "entries", not a distinct count of raw sessions.
// lastUpdated = most recent updated_at across those rows.
export async function getAccTrackStats(
  trackKey: string,
  board: AccBoard = PERSISTENT_DRY,
): Promise<AccTrackStats> {
  const [countRes, latestRes] = await Promise.all([
    applySeasonFilter(
      supabase
        .from('acc_hotlap_leaderboard')
        .select('*', { count: 'exact', head: true })
        .eq('track_key', trackKey)
        .eq('board_scope', board.scope),
      board.season,
    ),
    applySeasonFilter(
      supabase
        .from('acc_hotlap_leaderboard')
        .select('updated_at')
        .eq('track_key', trackKey)
        .eq('board_scope', board.scope),
      board.season,
    )
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

// Adapters into the sim-neutral shapes TrackList/TrackHeader consume — this
// is the one place that resolves ACC's numeric carModel into an actual logo
// URL, so the shared components never need to know ACC has numeric car IDs.
export function toTrackSummary(track: AccTrack): TrackSummary {
  return {
    trackKey: track.trackKey,
    displayName: track.displayName,
    splashArtUrl: track.splashArtUrl,
    country: track.country,
    location: track.location,
    mapUrl: track.mapUrl,
  };
}

export function toTrackTopEntry(entry: EnrichedAccHotLapEntry): TrackTopEntry {
  const iconName = entry.carModel != null ? accCarManufacturerIconName(entry.carModel) : null;
  return {
    rank: entry.rank,
    steamId: entry.steamId,
    driverName: entry.driverName,
    carLabel: entry.carModelName,
    manufacturerIconName: iconName,
    // Only fall back to the CDN guess when cardog-icons has no icon at all
    // (Alpine/Ginetta/KTM) — never both at once.
    manufacturerLogoUrl:
      !iconName && entry.carModel != null ? accCarManufacturerLogoUrl(entry.carModel) : null,
    bestLap: entry.bestLap,
    driverNumber: entry.driverNumber,
    country: entry.country,
  };
}
