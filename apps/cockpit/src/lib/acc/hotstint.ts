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
import { compareSeasonsDesc, seasonalTrackKeys } from '../seasonal-leaderboard';
import { applySeasonFilter, displaySeason } from './seasons';
import type { TrackWithTopTimes } from '@/components/TrackList';

// The hot-stint board: a driver's best average over 5 consecutive valid laps,
// ingested by the bot into acc_hotstint_leaderboard. Its board-defining key is
// the hot-lap key PLUS `qualifying` (the seasonal quali-stint variant lives on
// its own board). Every read MUST pin all of them — board_scope, season,
// is_wet AND qualifying — or it merges rows across boards and reports a "best"
// that doesn't belong to the board being shown. See the composite PK described
// in CLAUDE.md and the hot-lap board fix in acc/tracks.ts.
export type AccStintBoard = AccBoard & { qualifying: boolean };

// The all-time, dry, non-qualifying stint board — what the public Hot Stint
// tab shows. All current production rows sit here (board_scope='persistent',
// season='', is_wet=false, qualifying=false).
export const PERSISTENT_STINT: AccStintBoard = { ...PERSISTENT_DRY, qualifying: false };

type StintRow = {
  steam_id: string;
  driver_name: string;
  car_model: string | null;
  car_model_id: number | null;
  best_stint_ms: number;
  sectors_ms: number[] | null;
};

// The stint average reuses AccHotLapEntry's shape so it renders through the
// same class-grouped board component as hot laps — but bestLapMs/bestLap here
// carry the 5-lap STINT AVERAGE (best_stint_ms), not a single lap. The UI
// relabels the column "Stint Avg" via HotLapBoard's timeLabel prop.
function toStintEntry(row: StintRow, rank: number): AccHotLapEntry {
  const carModelId = row.car_model_id;
  const bestStintMs = row.best_stint_ms;
  return {
    rank,
    steamId: row.steam_id,
    driverName: row.driver_name,
    carGroup: resolveCarGroup(carModelId),
    carModel: carModelId,
    carModelName: row.car_model,
    bestLapMs: bestStintMs,
    bestLap: msToLaptime(bestStintMs)!,
    sectorsMs: row.sectors_ms,
  };
}

const STINT_COLS = 'steam_id, driver_name, car_model, car_model_id, best_stint_ms, sectors_ms';

// Class-grouped stint board for one track, best stint first within each class.
export async function getAccTrackHotStint(
  trackKey: string,
  board: AccStintBoard = PERSISTENT_STINT,
): Promise<Record<string, AccHotLapEntry[]>> {
  const { data, error } = await applySeasonFilter(
    supabase
      .from('acc_hotstint_leaderboard')
      .select(STINT_COLS)
      .eq('track_key', trackKey)
      .eq('board_scope', board.scope)
      .eq('is_wet', board.isWet)
      .eq('qualifying', board.qualifying),
    board.season,
  ).order('best_stint_ms', { ascending: true });

  if (error) {
    console.error(`ACC hot-stint leaderboard lookup failed for "${trackKey}":`, error);
    return {};
  }

  const byCarGroup: Record<string, AccHotLapEntry[]> = {};
  // Collapse a merged season's (driver, car) duplicates — keep the best stint.
  const seen = new Set<string>();
  for (const row of (data ?? []) as StintRow[]) {
    const dedupKey = `${row.steam_id}:${row.car_model_id}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    const carGroup = resolveCarGroup(row.car_model_id);
    const entries = byCarGroup[carGroup] ?? (byCarGroup[carGroup] = []);
    entries.push(toStintEntry(row, entries.length + 1));
  }
  return byCarGroup;
}

// Outright fastest N stint averages across every class combined — for the
// Hot Stint track-list summary card.
export async function getAccTrackTopStints(
  trackKey: string,
  limit = 3,
  board: AccStintBoard = PERSISTENT_STINT,
): Promise<AccHotLapEntry[]> {
  // Over-fetch so dedup of a merged season's (driver, car) duplicates still
  // leaves `limit` unique entries.
  const { data, error } = await applySeasonFilter(
    supabase
      .from('acc_hotstint_leaderboard')
      .select(STINT_COLS)
      .eq('track_key', trackKey)
      .eq('board_scope', board.scope)
      .eq('is_wet', board.isWet)
      .eq('qualifying', board.qualifying),
    board.season,
  )
    .order('best_stint_ms', { ascending: true })
    .limit(limit * 2 + 6);

  if (error) {
    console.error(`ACC hot-stint top-times lookup failed for "${trackKey}":`, error);
    return [];
  }

  const seen = new Set<string>();
  const out: AccHotLapEntry[] = [];
  for (const row of (data ?? []) as StintRow[]) {
    const dedupKey = `${row.steam_id}:${row.car_model_id}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    out.push(toStintEntry(row, out.length + 1));
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
        .eq('is_wet', board.isWet)
        .eq('qualifying', board.qualifying),
      board.season,
    ),
    applySeasonFilter(
      supabase
        .from('acc_hotstint_leaderboard')
        .select('updated_at')
        .eq('track_key', trackKey)
        .eq('board_scope', board.scope)
        .eq('is_wet', board.isWet)
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
      .eq('is_wet', false)
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
  const board: AccStintBoard = { scope: 'seasonal', season, isWet: false, qualifying: false };

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
      const [topStints, stats] = await Promise.all([
        getAccTrackTopStints(key, 3, board),
        getAccStintTrackStats(key, board),
      ]);
      return {
        ...(meta
          ? toTrackSummary(meta)
          : { trackKey: key, displayName: key, splashArtUrl: null, country: null, location: null, mapUrl: null }),
        topTimes: topStints.map(toTrackTopEntry),
        ...stats,
      };
    }),
  );
}
