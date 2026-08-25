import { unstable_cache } from 'next/cache';
import { msToLaptime, accCarClassName, accCarManufacturerIconName } from '@sra/domain';
import { accCarManufacturerLogoUrl } from './manufacturer-logo';
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

// acc_tracks.splash_art_url points at static.simracingalliance.com, whose
// TLS cert expired 2026-08-25 (a 90-day Let's Encrypt cert whose renewal
// automation broke — see the server's own certbot state, out of this repo's
// control). Every browser refuses the connection, so every track's map
// graphic silently failed to load — not a missing-image problem, a cert
// problem, and one increasingly bad since only Vercel's already-cached
// image-optimizer copies still worked as the cache aged. Downloaded all 24
// distinct map_*.png files (25 rows, nurburgring/nurburgring_24h share one
// file) straight from that domain 2026-08-25 (still serves real bytes over
// plain HTTP/curl — only browser TLS validation rejects it) and re-hosted
// them locally so this doesn't depend on that cert ever getting fixed.
// Remove once the cert is renewed for good, if `row.splash_art_url` should
// resume being the source of truth — until then this always wins.
const TRACK_MAP_OVERRIDES: Readonly<Record<string, string>> = {
  barcelona: '/tracks/maps/map_barcelona.png',
  brands_hatch: '/tracks/maps/map_brands_hatch.png',
  cota: '/tracks/maps/map_cota.png',
  donington: '/tracks/maps/map_donington.png',
  hungaroring: '/tracks/maps/map_hungaroring.png',
  imola: '/tracks/maps/map_imola.png',
  indianapolis: '/tracks/maps/map_indianapolis.png',
  kyalami: '/tracks/maps/map_kyalami.png',
  laguna_seca: '/tracks/maps/map_laguna_seca.png',
  misano: '/tracks/maps/map_misano.png',
  monza: '/tracks/maps/map_monza.png',
  mount_panorama: '/tracks/maps/map_mount_panorama.png',
  nurburgring: '/tracks/maps/map_nurburgring.png',
  nurburgring_24h: '/tracks/maps/map_nurburgring.png',
  oulton_park: '/tracks/maps/map_oulton_park.png',
  paul_ricard: '/tracks/maps/map_paul_ricard.png',
  red_bull_ring: '/tracks/maps/map_red_bull_ring.png',
  silverstone: '/tracks/maps/map_silverstone.png',
  snetterton: '/tracks/maps/map_snetterton.png',
  spa: '/tracks/maps/map_spa.png',
  suzuka: '/tracks/maps/map_suzuka.png',
  valencia: '/tracks/maps/map_valencia.png',
  watkins_glen: '/tracks/maps/map_watkins_glen.png',
  zandvoort: '/tracks/maps/map_zandvoort.png',
  zolder: '/tracks/maps/map_zolder.png',
};

// The track preview PHOTOS (photo_*.jpg) 404 directly from
// static.simracingalliance.com — genuinely gone (confirmed 2026-08-25,
// bypassing the expired-cert issue above with curl -k: still a real 404,
// not a TLS failure), unlike the map graphics. Recovered all 24 from the
// Wayback Machine's archived copies of the same URLs (closest snapshot per
// track, mostly 2026-06-13; a couple of downloads came back truncated on
// the first pass — re-verified every file's JPEG EOF marker (FFD9) before
// keeping any of them) and re-hosted locally, same reasoning as
// TRACK_MAP_OVERRIDES above. nurburgring_24h shares nurburgring's photo —
// same real-world venue, no separate capture exists.
const TRACK_PHOTO_OVERRIDES: Readonly<Record<string, string>> = {
  barcelona: '/tracks/photos/photo_barcelona.jpg',
  brands_hatch: '/tracks/photos/photo_brands_hatch.jpg',
  cota: '/tracks/photos/photo_cota.jpg',
  donington: '/tracks/photos/photo_donington.jpg',
  hungaroring: '/tracks/photos/photo_hungaroring.jpg',
  imola: '/tracks/photos/photo_imola.jpg',
  indianapolis: '/tracks/photos/photo_indianapolis.jpg',
  kyalami: '/tracks/photos/photo_kyalami.jpg',
  laguna_seca: '/tracks/photos/photo_laguna_seca.jpg',
  misano: '/tracks/photos/photo_misano.jpg',
  monza: '/tracks/photos/photo_monza.jpg',
  mount_panorama: '/tracks/photos/photo_mount_panorama.jpg',
  nurburgring: '/tracks/photos/photo_nurburgring.jpg',
  nurburgring_24h: '/tracks/photos/photo_nurburgring.jpg',
  oulton_park: '/tracks/photos/photo_oulton_park.jpg',
  paul_ricard: '/tracks/photos/photo_paul_ricard.jpg',
  red_bull_ring: '/tracks/photos/photo_red_bull_ring.jpg',
  silverstone: '/tracks/photos/photo_silverstone.jpg',
  snetterton: '/tracks/photos/photo_snetterton.jpg',
  spa: '/tracks/photos/photo_spa.jpg',
  suzuka: '/tracks/photos/photo_suzuka.jpg',
  valencia: '/tracks/photos/photo_valencia.jpg',
  watkins_glen: '/tracks/photos/photo_watkins_glen.jpg',
  zandvoort: '/tracks/photos/photo_zandvoort.jpg',
  zolder: '/tracks/photos/photo_zolder.jpg',
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

function toAccTrack(row: AccTrackRow, curatedNames: Map<string, string>): AccTrack {
  return {
    trackKey: row.track_key,
    displayName: curatedNames.get(row.track_key) ?? row.display_name,
    splashArtUrl: TRACK_PHOTO_OVERRIDES[row.track_key] ?? null,
    country: row.country ?? null,
    location: row.location ?? null,
    mapUrl: TRACK_MAP_OVERRIDES[row.track_key] ?? row.splash_art_url ?? null,
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
