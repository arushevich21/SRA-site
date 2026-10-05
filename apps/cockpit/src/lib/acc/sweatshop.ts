import 'server-only';
import { unstable_cache } from 'next/cache';
import {
  aggregateSweatshop,
  validityTier,
  type ValidityTier,
  validPercent,
  type SweatshopDriverTotal,
  type SweatshopLapRow,
} from '@sra/domain';
import { accTrackDisplayName, accTrackKeyForDisplay } from '@/content/sim-catalog';
import { ACC_PAST_SEASON_TRACKS, ACC_PAST_SEASONS_IN_ROUND_ORDER } from '@/content/acc-past-season-tracks';
import { supabase } from '../supabase';
import { getAccSeasonCalendar, getSeasonGate } from '../seasonal-leaderboard';
import { getDriverInfoBySteamIds, driverInfoFor, stripSteamIdPrefix } from '../driver-lookup';
import { getDriverTierBadge, type DriverTierBadge } from '../driver-tier-badge';
import { eventInstant } from '../event-time';
import { applySeasonFilter } from './seasons';
import { getAccTracks } from './tracks';

// Sweatshop: season lap counts off the seasonal hot-lap board. Counting only —
// no lap times — so the per-row total_laps/total_valid_laps columns are all
// this reads (see packages/domain/src/acc/sweatshop.ts for how they sum).

export const SWEATSHOP_TAG = 'acc-sweatshop';

// Every seasonal row for a display season. Pages through PostgREST's
// 1000-row cap with a stable ORDER BY over the PK, same as
// seasonalTrackKeys in seasonal-leaderboard.ts — a full season is 1–2.5k rows.
async function fetchSeasonLapRows(season: string): Promise<SweatshopLapRow[]> {
  const rows: SweatshopLapRow[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const query = applySeasonFilter(
      supabase
        .from('acc_hotlap_leaderboard')
        .select('track_key, steam_id, driver_name, best_lap_ms, total_laps, total_valid_laps')
        .eq('board_scope', 'seasonal'),
      season,
    );
    const { data, error } = await query
      .order('track_key')
      .order('car_model_id')
      .order('steam_id')
      .order('is_wet')
      .range(from, from + page - 1);
    if (error) {
      console.error(`Sweatshop lap-count lookup failed for "${season}":`, error);
      return [];
    }
    if (!data || data.length === 0) break;
    for (const r of data) {
      rows.push({
        // Board rows carry the S-prefixed id; drivers.steam_id is bare.
        steamId: stripSteamIdPrefix(r.steam_id as string),
        driverName: r.driver_name as string,
        trackKey: r.track_key as string,
        totalLaps: r.total_laps as number,
        validLaps: r.total_valid_laps as number,
        bestLapMs: r.best_lap_ms as number,
      });
    }
    if (data.length < page) break;
  }
  return rows;
}

const getSeasonLapRows = unstable_cache(fetchSeasonLapRows, ['acc-sweatshop-rows'], {
  revalidate: 300,
  tags: [SWEATSHOP_TAG],
});

export type SweatshopDriver = {
  steamId: string;
  name: string;
  driverNumber: number | null;
  country: string | null;
  badge: DriverTierBadge | null;
  // Sort key for the Division column: SRAlien, D1 Gold, D1 Silver … D4
  // Silver, then unassigned last.
  divisionOrder: number;
  laps: number;
  validLaps: number;
  rank: number;
  approxSecondsLapping: number;
};

export type SweatshopLeader = {
  driver: SweatshopDriver;
  validPct: number | null;
  // Leader's valid rate against the field's — picks the callout's tone
  // (content/sweatshop-quips.ts).
  tier: ValidityTier;
  // Laps clear of the next driver (0 on a tie).
  margin: number;
};

export type SweatshopTrackCard = {
  trackKey: string;
  displayName: string;
  // Calendar round number, or null for a season with no calendar.
  round: number | null;
  // false = an unreleased round of the live season: shown, not clickable.
  released: boolean;
  current: boolean;
  laps: number;
  leaderName: string | null;
  leaderLaps: number;
};

// drivers.display_name embeds the number as a "┊{number}" suffix (see
// driver-display-name.ts); Sweatshop shows the number in its own slot, so
// strip it the same way srating.ts does.
function bareName(name: string): string {
  return name.split('┊')[0].trim() || name;
}

function divisionOrder(info: { isSralien: boolean; division: number | null; tier: string | null }): number {
  if (info.isSralien) return 0;
  if (info.division == null) return 99;
  return info.division * 2 - 1 + (info.tier === 'silver' ? 1 : 0);
}

async function enrich(totals: SweatshopDriverTotal[]): Promise<SweatshopDriver[]> {
  const infoMap = await getDriverInfoBySteamIds(totals.map((t) => t.steamId));
  return totals.map((t) => {
    const info = driverInfoFor(infoMap, t.steamId);
    return {
      steamId: t.steamId,
      name: bareName(info.displayName ?? t.driverName),
      driverNumber: info.driverNumber,
      country: info.country,
      badge: getDriverTierBadge(info),
      divisionOrder: divisionOrder(info),
      laps: t.laps,
      validLaps: t.validLaps,
      rank: t.rank,
      approxSecondsLapping: t.approxSecondsLapping,
    };
  });
}

function leaderOf(drivers: SweatshopDriver[]): SweatshopLeader | null {
  const top = drivers[0];
  if (!top) return null;
  return {
    driver: top,
    validPct: validPercent(top),
    tier: validityTier(top, drivers),
    margin: drivers[1] ? top.laps - drivers[1].laps : top.laps,
  };
}

type CalendarCard = Omit<SweatshopTrackCard, 'laps' | 'leaderName' | 'leaderLaps'>;

// Which tracks count toward a season — both views use only these:
//   • S19 onward: the championship calendar (championship_rounds), in round
//     order. For the live season, only rounds an admin has released, so an
//     unreleased round's laps can't surface in the season total either.
//   • S7–S18: the hand-kept list in content/acc-past-season-tracks.ts.
// Laps on any other track that season (pre-season qualifying servers like
// S19's Zandvoort, stray layouts like S18's Nürburgring 24h) are left out.
// A season in neither source falls back to every track with laps.
async function getSeasonScope(season: string): Promise<{
  rows: SweatshopLapRow[];
  calendarCards: CalendarCard[];
}> {
  const [rows, calendar, gate, accTracks] = await Promise.all([
    getSeasonLapRows(season),
    getAccSeasonCalendar(season),
    getSeasonGate(),
    getAccTracks(),
  ]);
  const nameByKey = new Map(accTracks.map((t) => [t.trackKey, t.displayName]));
  const trackName = (key: string) => nameByKey.get(key) ?? accTrackDisplayName(key) ?? key;
  const unnumbered = (keys: Iterable<string>): CalendarCard[] =>
    [...new Set(keys)]
      .map((trackKey) => ({ trackKey, displayName: trackName(trackKey), round: null, released: true, current: false }))
      .sort((x, y) => x.displayName.localeCompare(y.displayName));

  let calendarCards: CalendarCard[];
  if (calendar) {
    const gated = season.toUpperCase() === gate.gatedSeason;
    // "This week" = the first released round whose race night hasn't passed
    // (with a day's grace so race night itself still reads as current).
    const now = Date.now();
    const current = calendar.find(
      (r) => (!gated || r.hotlapReleased) && r.date != null && eventInstant(r.date) > now - 36 * 3600_000,
    );
    calendarCards = [];
    for (const r of calendar) {
      const trackKey = accTrackKeyForDisplay(r.track);
      if (!trackKey) continue;
      calendarCards.push({
        trackKey,
        displayName: r.track,
        round: r.round,
        released: !gated || !!r.hotlapReleased,
        current: r === current,
      });
    }
  } else {
    const past = ACC_PAST_SEASON_TRACKS[season.toUpperCase()];
    calendarCards =
      past && ACC_PAST_SEASONS_IN_ROUND_ORDER.has(season.toUpperCase())
        ? past.map((trackKey, i) => ({
            trackKey,
            displayName: trackName(trackKey),
            round: i + 1,
            released: true,
            current: false,
          }))
        : unnumbered(past ?? rows.map((r) => r.trackKey));
  }

  const counted = new Set(calendarCards.filter((c) => c.released).map((c) => c.trackKey));
  return { rows: rows.filter((r) => counted.has(r.trackKey)), calendarCards };
}

// Season-total view: every driver with at least one counted lap, most first.
export async function getSweatshopSeason(season: string) {
  const { rows } = await getSeasonScope(season);
  const drivers = await enrich(aggregateSweatshop(rows));
  return { drivers, leader: leaderOf(drivers), totalLaps: drivers.reduce((n, d) => n + d.laps, 0) };
}

// The week/track cards across the top of the By Track view, in the order
// getSeasonScope lists the season's tracks.
export async function getSweatshopTrackCards(season: string): Promise<SweatshopTrackCard[]> {
  const { rows, calendarCards } = await getSeasonScope(season);

  const cards = calendarCards.map((c) => {
    // Unreleased rounds were already filtered out of `rows`, so they never
    // leak counts or a leader.
    const totals = aggregateSweatshop(rows, { trackKey: c.trackKey });
    return {
      ...c,
      laps: totals.reduce((n, t) => n + t.laps, 0),
      leaderSteamId: totals[0]?.steamId ?? null,
      leaderName: totals[0]?.driverName ?? null,
      leaderLaps: totals[0]?.laps ?? 0,
    };
  });

  // Swap the bot-snapshot leader names for live display names in one lookup.
  const infoMap = await getDriverInfoBySteamIds(
    cards.map((c) => c.leaderSteamId).filter((id): id is string => id != null),
  );
  return cards.map(({ leaderSteamId, ...c }) => ({
    ...c,
    leaderName: leaderSteamId ? bareName(driverInfoFor(infoMap, leaderSteamId).displayName ?? c.leaderName ?? '') : null,
  }));
}

// One track's board. null when the track isn't viewable this season (no laps,
// or an unreleased round of the live season) — the page 404s on that.
export async function getSweatshopTrack(season: string, trackKey: string) {
  const cards = await getSweatshopTrackCards(season);
  const card = cards.find((c) => c.trackKey === trackKey);
  if (!card || !card.released || card.laps === 0) return null;
  const { rows } = await getSeasonScope(season);
  const drivers = await enrich(aggregateSweatshop(rows, { trackKey }));
  return { card, cards, drivers, leader: leaderOf(drivers) };
}
