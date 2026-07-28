import 'server-only';
import type { AccHotLapEntry } from '@sra/shared-types';
import type { ChampionshipContent } from '@/content/championships';
import { getChampionships } from './championships-store';
import { accTrackKeyForDisplay } from '@/content/sim-catalog';
import {
  getAccTrackLeaderboard,
  getAccTracks,
  getAccTrackTopTimes,
  getAccTrackStats,
  toTrackSummary,
  toTrackTopEntry,
  type AccBoard,
} from './acc/tracks';
import type { TrackWithTopTimes } from '@/components/TrackList';
import { displaySeason, applySeasonFilter } from './acc/seasons';
import { supabase } from './supabase';

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

    // The Seasonal board is a distinct board_scope from the all-time
    // (persistent) one, keyed by the season code the ingest writes. We derive
    // that from the championship's registrationSeason (e.g. 's19' → 'S19');
    // without it we can't pin the board, so skip rather than fall back to the
    // persistent board and silently mislabel all-time bests as this season's.
    const season = (champ.registrationSeason ?? '').toUpperCase();
    if (!season) {
      console.warn(
        `Seasonal hot-lap board skipped for "${champ.slug}": no registrationSeason to pin the seasonal board`,
      );
      continue;
    }
    const board: AccBoard = { scope: 'seasonal', season };

    const rounds: SeasonalRoundBoard[] = [];
    for (const r of released) {
      const trackKey = accTrackKeyForDisplay(r.track);
      if (!trackKey) continue; // custom/unmapped track — no board to pull
      rounds.push({
        round: r.round,
        trackDisplay: r.track,
        trackKey,
        leaderboardByCarGroup: await getAccTrackLeaderboard(trackKey, board),
      });
    }

    if (rounds.length > 0) out.push({ slug: champ.slug, title: champ.title, rounds });
  }

  return out;
}

// ── Data-driven "browse by season" ────────────────────────────────────────────
// The seasonal leaderboards enumerate the seasons the ingest has written
// seasonal-scope rows for and render each as a Hot-Lap-style track list, with
// the newest season gated to admin-released rounds (getSeasonGate below).

// Season codes are 'S<n>' with an optional split suffix ('S14-2'). Sort
// numerically (newest first) so S18 > S9 — a plain string compare would put
// 'S9' above 'S18'. Splits sort after their base season ('S14-2' before 'S14'
// in descending order).
function seasonRank(s: string): [number, number] {
  const m = s.match(/^S(\d+)(?:-(\d+))?$/i);
  if (!m) return [-1, 0];
  return [Number(m[1]), m[2] ? Number(m[2]) : 0];
}
export function compareSeasonsDesc(a: string, b: string): number {
  const [am, asub] = seasonRank(a);
  const [bm, bsub] = seasonRank(b);
  return bm - am || bsub - asub || b.localeCompare(a);
}

// Distinct season codes present on the seasonal hot-lap board, newest first.
// Not filtered by is_wet — a season with only wet rows still counts (wet laps
// show on the board too, just without a reference-time badge). Pages through
// the column so a season is never missed to a single-request row cap.
export async function getHotlapSeasons(): Promise<string[]> {
  const seasons = new Set<string>();
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from('acc_hotlap_leaderboard')
      .select('season')
      .eq('board_scope', 'seasonal')
      .range(from, from + page - 1);
    if (error) {
      console.error('ACC seasonal season list lookup failed:', error);
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

// Whether the Seasonal tab should be shown at all: either an admin has released
// a per-round board, OR the ingest has written any seasonal-scope rows to
// browse. Historical seasons (S7–S18) make this true today even with no round
// released.
export async function hasSeasonalContent(): Promise<boolean> {
  if (await hasSeasonalReleased()) return true;
  // Cheap existence check — just "is there any seasonal row", not the full
  // distinct-season list (getHotlapSeasons pages the whole board and only runs
  // on the seasonal page itself).
  const { data, error } = await supabase
    .from('acc_hotlap_leaderboard')
    .select('track_key')
    .eq('board_scope', 'seasonal')
    .limit(1);
  if (error) {
    console.error('ACC seasonal existence check failed:', error);
    return false;
  }
  return (data ?? []).length > 0;
}

// The one season currently under admin reveal control — the newest ACC
// (non-endurance) season defined in content. For that season, only rounds an
// admin has flipped `hotlapReleased` on are visible on the seasonal
// leaderboards; every earlier season is shown in full straight from the DB.
// (See [[leaderboard-seasonal-release]].)
export type SeasonGate = { gatedSeason: string | null; releasedTrackKeys: Set<string> };

export async function getSeasonGate(): Promise<SeasonGate> {
  const champs = (await getChampionships()).filter(
    (c) => c.game === 'ACC' && !isEnduranceChampionship(c) && (c.registrationSeason ?? '') !== '',
  );
  if (champs.length === 0) return { gatedSeason: null, releasedTrackKeys: new Set() };

  // Newest season = the live one under reveal control.
  const current = champs
    .slice()
    .sort((a, b) =>
      compareSeasonsDesc((a.registrationSeason ?? '').toUpperCase(), (b.registrationSeason ?? '').toUpperCase()),
    )[0];

  const gatedSeason = (current.registrationSeason ?? '').toUpperCase();
  const releasedTrackKeys = new Set<string>();
  for (const r of current.schedule) {
    if (!r.hotlapReleased) continue;
    const key = accTrackKeyForDisplay(r.track);
    if (key) releasedTrackKeys.add(key);
  }
  return { gatedSeason, releasedTrackKeys };
}

// Track keys that have seasonal rows for `season` on the given table, with the
// newest-season reveal gate applied. Shared by the hot-lap and hot-stint
// seasonal track lists.
export async function seasonalTrackKeys(
  table: 'acc_hotlap_leaderboard' | 'acc_hotstint_leaderboard',
  season: string,
  extraEq: Record<string, string | boolean> = {},
): Promise<string[]> {
  let query = supabase
    .from(table)
    .select('track_key')
    .eq('board_scope', 'seasonal');
  for (const [col, val] of Object.entries(extraEq)) query = query.eq(col, val);
  query = applySeasonFilter(query, season);

  const [{ data, error }, gate] = await Promise.all([query, getSeasonGate()]);
  if (error) {
    console.error(`ACC seasonal track-key lookup failed for "${season}" on ${table}:`, error);
    return [];
  }

  let keys = [...new Set((data ?? []).map((r) => r.track_key as string))];
  if (season === gate.gatedSeason) keys = keys.filter((k) => gate.releasedTrackKeys.has(k));
  return keys;
}

// Whether any row exists for this track/season (on the given table) with
// is_wet=true — i.e. whether that round was run in the wet. Used to suffix
// " (Wet)" onto the track name while browsing a season (see AccBoard's
// comment in acc/tracks.ts for why is_wet isn't otherwise a board dimension —
// wet and dry laps share the same board and this is purely a display label,
// not a board split). Shared by the hot-lap and hot-stint seasonal views.
export async function hasWetSessionRows(
  table: 'acc_hotlap_leaderboard' | 'acc_hotstint_leaderboard',
  trackKey: string,
  season: string,
  extraEq: Record<string, string | boolean> = {},
): Promise<boolean> {
  let query = supabase
    .from(table)
    .select('track_key', { head: true, count: 'exact' })
    .eq('board_scope', 'seasonal')
    .eq('track_key', trackKey)
    .eq('is_wet', true);
  for (const [col, val] of Object.entries(extraEq)) query = query.eq(col, val);
  query = applySeasonFilter(query, season);

  const { count, error } = await query;
  if (error) {
    console.error(`Wet-session check failed for "${trackKey}"/"${season}" on ${table}:`, error);
    return false;
  }
  return (count ?? 0) > 0;
}

// Hot-lap seasonal track list, shaped exactly like the Hot Lap index
// (TrackWithTopTimes) so it renders through the same TrackList card component.
// Top-3 and counts are pinned to (seasonal, season); a track run in the wet
// gets " (Wet)" appended to its displayed name (see hasWetSessionRows).
export async function getSeasonHotlapTrackList(season: string): Promise<TrackWithTopTimes[]> {
  if (!season) return [];
  const board: AccBoard = { scope: 'seasonal', season };

  const [keys, tracks] = await Promise.all([
    seasonalTrackKeys('acc_hotlap_leaderboard', season),
    getAccTracks(),
  ]);

  const metaByKey = new Map(tracks.map((t) => [t.trackKey, t]));
  const sorted = keys.sort((a, b) =>
    (metaByKey.get(a)?.displayName ?? a).localeCompare(metaByKey.get(b)?.displayName ?? b),
  );

  return Promise.all(
    sorted.map(async (key) => {
      const meta = metaByKey.get(key);
      const [topTimes, stats, isWet] = await Promise.all([
        getAccTrackTopTimes(key, 3, board),
        getAccTrackStats(key, board),
        hasWetSessionRows('acc_hotlap_leaderboard', key, season),
      ]);
      const summary = meta
        ? toTrackSummary(meta)
        : { trackKey: key, displayName: key, splashArtUrl: null, country: null, location: null, mapUrl: null };
      return {
        ...summary,
        displayName: isWet ? `${summary.displayName} (Wet)` : summary.displayName,
        topTimes: topTimes.map(toTrackTopEntry),
        ...stats,
      };
    }),
  );
}
