import { msToLaptime } from '@sra/domain';
import type { AccHotLapEntry } from '@sra/shared-types';
import { supabase } from '../supabase';
import {
  resolveCarGroup,
  getAccTracks,
  toTrackSummary,
  toTrackTopEntry,
  type AccBoard,
  PERSISTENT_DRY,
} from './tracks';
import { compareSeasonsDesc, seasonalTrackKeys, hasWetSessionRows } from '../seasonal-leaderboard';
import { applySeasonFilter, displaySeason } from './seasons';
import { getDriverInfoBySteamIds, driverInfoFor, stripSteamIdPrefix, type DriverInfo } from '../driver-lookup';
import { classifyLapTier, type LapTier } from './reference-times';
import type { TrackWithTopTimes } from '@/components/TrackList';

// AccHotLapEntry (reused for stint rows) enriched with the driver's registered
// SRA number/nationality and its reference-time tier — see lib/driver-lookup.ts,
// lib/acc/reference-times.ts, and lib/acc/tracks.ts's matching
// EnrichedAccHotLapEntry.
type EnrichedStintEntry = AccHotLapEntry & DriverInfo & { lapTier: LapTier | null };

// The hot-stint board: a driver's best average over 5 consecutive valid laps,
// ingested by the bot into acc_hotstint_leaderboard. Its board-defining key is
// the hot-lap key PLUS `qualifying` (the seasonal quali-stint variant lives on
// its own board). Every read MUST pin board_scope, season AND qualifying — or
// it merges rows across boards and reports a "best" that doesn't belong to
// the board being shown. See the composite PK described in CLAUDE.md and the
// hot-lap board fix in acc/tracks.ts.
//
// is_wet is NOT pinned — same as the hot-lap board (see AccBoard's comment in
// acc/tracks.ts): wet and dry stints share one board, fastest wins regardless
// of conditions.
export type AccStintBoard = AccBoard & { qualifying: boolean };

// The all-time, non-qualifying stint board — what the public Hot Stint tab
// shows (persistent scope, season='' by the migration's backfill default).
export const PERSISTENT_STINT: AccStintBoard = { ...PERSISTENT_DRY, qualifying: false };

type StintRow = {
  steam_id: string;
  driver_name: string;
  car_model: string | null;
  car_model_id: number | null;
  best_stint_ms: number;
  sectors_ms: number[] | null;
  is_wet: boolean;
};

// The stint average reuses AccHotLapEntry's shape so it renders through the
// same class-grouped board component as hot laps — but bestLapMs/bestLap here
// carry the 5-lap STINT AVERAGE (best_stint_ms), not a single lap. The UI
// relabels the column "Stint Avg" via HotLapBoard's timeLabel prop.
function toStintEntry(
  row: StintRow,
  rank: number,
  driverInfo: Map<string, DriverInfo>,
  trackKey: string,
): EnrichedStintEntry {
  const carModelId = row.car_model_id;
  const bestStintMs = row.best_stint_ms;
  const carGroup = resolveCarGroup(carModelId);
  return {
    rank,
    steamId: row.steam_id,
    driverName: row.driver_name,
    carGroup,
    carModel: carModelId,
    carModelName: row.car_model,
    bestLapMs: bestStintMs,
    bestLap: msToLaptime(bestStintMs)!,
    sectorsMs: row.sectors_ms,
    ...driverInfoFor(driverInfo, stripSteamIdPrefix(row.steam_id)),
    // Reference times are GT3-only and dry-only — a wet stint still shows,
    // just without a tier badge.
    lapTier: carGroup === 'GT3' && !row.is_wet ? classifyLapTier(bestStintMs, trackKey, 'stint') : null,
  };
}

const STINT_COLS = 'steam_id, driver_name, car_model, car_model_id, best_stint_ms, sectors_ms, is_wet';

// Class-grouped stint board for one track, best stint first within each class.
export async function getAccTrackHotStint(
  trackKey: string,
  board: AccStintBoard = PERSISTENT_STINT,
): Promise<Record<string, EnrichedStintEntry[]>> {
  const { data, error } = await applySeasonFilter(
    supabase
      .from('acc_hotstint_leaderboard')
      .select(STINT_COLS)
      .eq('track_key', trackKey)
      .eq('board_scope', board.scope)
      .eq('qualifying', board.qualifying),
    board.season,
  ).order('best_stint_ms', { ascending: true });

  if (error) {
    console.error(`ACC hot-stint leaderboard lookup failed for "${trackKey}":`, error);
    return {};
  }

  const rows = (data ?? []) as StintRow[];
  const driverInfo = await getDriverInfoBySteamIds(
    rows.map((row) => stripSteamIdPrefix(row.steam_id)),
  );

  const byCarGroup: Record<string, EnrichedStintEntry[]> = {};
  // Wet and dry stints share one dedup key (steam_id, car_model_id) — rows
  // arrive best-first, so a driver's fastest stint in a car wins regardless
  // of conditions; this also collapses a merged season's duplicate half.
  const seen = new Set<string>();
  for (const row of rows) {
    const dedupKey = `${row.steam_id}:${row.car_model_id}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    const carGroup = resolveCarGroup(row.car_model_id);
    const entries = byCarGroup[carGroup] ?? (byCarGroup[carGroup] = []);
    entries.push(toStintEntry(row, entries.length + 1, driverInfo, trackKey));
  }
  return byCarGroup;
}

// Outright fastest N stint averages across every class combined — for the
// Hot Stint track-list summary card.
export async function getAccTrackTopStints(
  trackKey: string,
  limit = 3,
  board: AccStintBoard = PERSISTENT_STINT,
): Promise<EnrichedStintEntry[]> {
  // Over-fetch so dedup of a merged season's (driver, car) duplicates still
  // leaves `limit` unique entries.
  const { data, error } = await applySeasonFilter(
    supabase
      .from('acc_hotstint_leaderboard')
      .select(STINT_COLS)
      .eq('track_key', trackKey)
      .eq('board_scope', board.scope)
      .eq('qualifying', board.qualifying),
    board.season,
  )
    .order('best_stint_ms', { ascending: true })
    .limit(limit * 2 + 6);

  if (error) {
    console.error(`ACC hot-stint top-times lookup failed for "${trackKey}":`, error);
    return [];
  }

  const rows = (data ?? []) as StintRow[];
  const driverInfo = await getDriverInfoBySteamIds(
    rows.map((row) => stripSteamIdPrefix(row.steam_id)),
  );

  const seen = new Set<string>();
  const out: EnrichedStintEntry[] = [];
  for (const row of rows) {
    const dedupKey = `${row.steam_id}:${row.car_model_id}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    out.push(toStintEntry(row, out.length + 1, driverInfo, trackKey));
    if (out.length >= limit) break;
  }
  return out;
}

export type AccStintTrackStats = {
  entriesCount: number;
  lastUpdated: string | null;
};

// Row count + most-recent update for the Hot Stint track list, pinned to the
// same board so counts reflect that board only.
export async function getAccStintTrackStats(
  trackKey: string,
  board: AccStintBoard = PERSISTENT_STINT,
): Promise<AccStintTrackStats> {
  const [countRes, latestRes] = await Promise.all([
    applySeasonFilter(
      supabase
        .from('acc_hotstint_leaderboard')
        .select('*', { count: 'exact', head: true })
        .eq('track_key', trackKey)
        .eq('board_scope', board.scope)
        .eq('qualifying', board.qualifying),
      board.season,
    ),
    applySeasonFilter(
      supabase
        .from('acc_hotstint_leaderboard')
        .select('updated_at')
        .eq('track_key', trackKey)
        .eq('board_scope', board.scope)
        .eq('qualifying', board.qualifying),
      board.season,
    )
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (countRes.error) {
    console.error(`ACC stint entries-count lookup failed for "${trackKey}":`, countRes.error);
  }
  if (latestRes.error) {
    console.error(`ACC stint last-updated lookup failed for "${trackKey}":`, latestRes.error);
  }

  return {
    entriesCount: countRes.count ?? 0,
    lastUpdated: (latestRes.data?.updated_at as string | undefined) ?? null,
  };
}

// ── Data-driven "browse by season" for the Hot Stint tab ──────────────────────
// Mirrors the hot-lap season browser (seasonal-leaderboard.ts) but reads the
// stint board and pins qualifying=false (the practice-stint variant; the
// qualifying=true quali-stint board is not surfaced yet).

// Distinct season codes on the seasonal, dry, non-qualifying stint board,
// newest first. Pages the column so no season is missed to a row cap.
export async function getHotStintSeasons(): Promise<string[]> {
  const seasons = new Set<string>();
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from('acc_hotstint_leaderboard')
      .select('season')
      .eq('board_scope', 'seasonal')
      .eq('qualifying', false)
      .range(from, from + page - 1);
    if (error) {
      console.error('ACC stint season list lookup failed:', error);
      break;
    }
    if (!data || data.length === 0) break;
    for (const r of data) {
      const s = (r.season as string) ?? '';
      if (s !== '') seasons.add(displaySeason(s));
    }
    if (data.length < page) break;
  }
  return [...seasons].sort(compareSeasonsDesc);
}

// Hot-stint seasonal track list, shaped like the Hot Stint index
// (TrackWithTopTimes) so it renders through the same TrackList card component.
// Top-3 and counts are pinned to (seasonal, season, dry, non-qualifying), with
// the newest-season reveal gate applied (via seasonalTrackKeys).
export async function getSeasonStintTrackList(season: string): Promise<TrackWithTopTimes[]> {
  if (!season) return [];
  const board: AccStintBoard = { scope: 'seasonal', season, qualifying: false };

  const [keys, tracks] = await Promise.all([
    seasonalTrackKeys('acc_hotstint_leaderboard', season, { qualifying: false }),
    getAccTracks(),
  ]);

  const metaByKey = new Map(tracks.map((t) => [t.trackKey, t]));
  const sorted = keys.sort((a, b) =>
    (metaByKey.get(a)?.displayName ?? a).localeCompare(metaByKey.get(b)?.displayName ?? b),
  );

  return Promise.all(
    sorted.map(async (key) => {
      const meta = metaByKey.get(key);
      const [topStints, stats, isWet] = await Promise.all([
        getAccTrackTopStints(key, 3, board),
        getAccStintTrackStats(key, board),
        hasWetSessionRows('acc_hotstint_leaderboard', key, season, { qualifying: false }),
      ]);
      const summary = meta
        ? toTrackSummary(meta)
        : { trackKey: key, displayName: key, splashArtUrl: null, country: null, location: null, mapUrl: null };
      return {
        ...summary,
        displayName: isWet ? `${summary.displayName} (Wet)` : summary.displayName,
        topTimes: topStints.map(toTrackTopEntry),
        ...stats,
      };
    }),
  );
}
