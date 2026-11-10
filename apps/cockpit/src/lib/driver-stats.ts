import 'server-only';
import { accCarModelName } from '@sra/domain';
import { supabase } from '@/lib/supabase';
import { ENGINE } from '@/lib/acc/srating';
import { resolveAccTrackName } from '@/lib/acc/track-name';
import { resolveCarGroup } from '@/lib/acc/tracks';
import { getChampionships } from '@/lib/championships-store';
import { isEnduranceChampionship, seasonTrackAllowList } from '@/lib/seasonal-leaderboard';

// Everything the driver stats panel shows, for one driver, read from the
// rollups (driver_race_stats, driver_lap_totals — refreshed nightly, see
// supabase/migrations/20261012_acc_lap_ledger_and_site_stats.sql) plus a few
// small indexed reads. Nothing here touches raw laps.
//
// Every section is independently nullable: null means "no data for this
// driver" (never raced GT3, not rated, ledger has no laps for them yet), and
// the panel hides that block rather than rendering zeros.

export type RaceRecord = {
  starts: number;
  wins: number;
  podiums: number;
  top10s: number;
  bestFinish: number | null;
  avgFinish: number | null;
  seasons: number;
  firstRace: string | null;
  computedAt: string;
};

export type RatingSnapshot = {
  composite: number | null;
  pacePct: number | null;
  osPct: number | null;
  consPct: number | null;
  numRaces: number | null;
  rank: number | null;
  rankedOf: number | null;
};

export type RatingPoint = { label: string; composite: number };

export type RecentResult = {
  season: number;
  round: number;
  track: string;
  date: string | null;
  position: number;
  note: string | null; // e.g. 'Server crash' — shown, not hidden
  href: string | null; // the round's result page, where the site has one
};

export type Mileage = {
  laps: number;
  validLaps: number;
  sessions: number;
  firstSeen: string | null;
  topTrack: string | null;
  topTrackLaps: number | null;
  topCar: string | null;
  topCarLaps: number | null;
  lapsRank: number;
  computedAt: string;
  // Every car they've driven, most laps first (driver_car_laps). Empty until
  // that rollup exists — the panel then falls back to topCar.
  cars: CarLaps[];
};

export type CarLaps = { name: string; laps: number; share: number };

export type Placing = {
  season: string;
  track: string;
  carClass: string;
  car: string | null;
  position: number;
  boardSize: number;
  bestLapMs: number;
  isWet: boolean;
  href: string;
};

export type DriverStats = {
  record: RaceRecord | null;
  rating: RatingSnapshot | null;
  trend: RatingPoint[];
  recent: RecentResult[];
  mileage: Mileage | null;
  placings: Placing[];
};

const TREND_POINTS = 24;
const RECENT_RESULTS = 5;

// steamId: bare SteamID64 (drivers.steam_id). Every source below stores the
// S-prefixed form — see CLAUDE.md's join rule. division: the driver's current
// division, used to open result links on their division's tab (history rows
// don't record which division a race was in).
export async function getDriverStats(steamId: string, division: number | null = null): Promise<DriverStats> {
  const playerId = `S${steamId}`;
  const [record, rating, history, mileage, placings] = await Promise.all([
    getRaceRecord(playerId),
    getRating(playerId),
    getHistory(playerId, division),
    getMileage(playerId),
    getPlacings(playerId),
  ]);
  return { record, rating, trend: history.trend, recent: history.recent, mileage, placings };
}

export async function getRaceRecord(playerId: string): Promise<RaceRecord | null> {
  const { data, error } = await supabase
    .from('driver_race_stats')
    .select('starts, wins, podiums, top10s, best_finish, avg_finish, seasons, first_race, computed_at')
    .eq('player_id', playerId)
    .eq('series', 'GT3')
    .maybeSingle();
  if (error) console.error('driver_race_stats read failed:', error);
  if (!data) return null;
  return {
    starts: Number(data.starts),
    wins: Number(data.wins),
    podiums: Number(data.podiums),
    top10s: Number(data.top10s),
    bestFinish: data.best_finish as number | null,
    avgFinish: data.avg_finish == null ? null : Number(data.avg_finish),
    seasons: Number(data.seasons),
    firstRace: data.first_race as string | null,
    computedAt: data.computed_at as string,
  };
}

// Rank matches the public SRAting board: among rated drivers linked to a
// drivers row (that board's drivers!inner join), by composite.
export async function getRating(playerId: string): Promise<RatingSnapshot | null> {
  const { data, error } = await supabase
    .from('driver_ratings')
    .select('composite, pace_pct, os_pct, cons_pct, num_races')
    .eq('player_id', playerId)
    .eq('engine', ENGINE)
    .maybeSingle();
  if (error) console.error('driver_ratings read failed:', error);
  if (!data) return null;

  const composite = data.composite == null ? null : Number(data.composite);
  let rank: number | null = null;
  let rankedOf: number | null = null;
  if (composite != null) {
    const [above, total] = await Promise.all([
      supabase
        .from('driver_ratings')
        .select('player_id', { count: 'exact', head: true })
        .eq('engine', ENGINE)
        .not('driver_id', 'is', null)
        .gt('composite', composite),
      supabase
        .from('driver_ratings')
        .select('player_id', { count: 'exact', head: true })
        .eq('engine', ENGINE)
        .not('driver_id', 'is', null),
    ]);
    if (above.count != null) rank = above.count + 1;
    rankedOf = total.count ?? null;
  }

  return {
    composite,
    pacePct: data.pace_pct == null ? null : Number(data.pace_pct),
    osPct: data.os_pct == null ? null : Number(data.os_pct),
    consPct: data.cons_pct == null ? null : Number(data.cons_pct),
    numRaces: data.num_races as number | null,
    rank,
    rankedOf,
  };
}

async function getHistory(
  playerId: string,
  division: number | null,
): Promise<{ trend: RatingPoint[]; recent: RecentResult[] }> {
  const linkersPromise = resultLinkers();
  const { data, error } = await supabase
    .from('srating_history')
    .select('season, event, track, event_date, finish_position, composite, exclude_reason')
    .eq('player_id', playerId)
    .eq('series', 'GT3')
    .order('season', { ascending: false })
    .order('event', { ascending: false })
    .limit(TREND_POINTS);
  if (error) console.error('srating_history read failed:', error);
  const rows = data ?? [];

  const trend = rows
    .filter((r) => r.composite != null)
    .map((r) => ({ label: `S${r.season} R${r.event}`, composite: Number(r.composite) }))
    .reverse();

  const linkers = await linkersPromise;
  const recent = rows
    .filter((r) => r.finish_position != null)
    .slice(0, RECENT_RESULTS)
    .map((r) => {
      const linker = linkers.get(r.season as number);
      const href =
        linker && linker.rounds.has(r.event as number)
          ? `/acc/championships/${linker.slug}/results/${r.event}${division ? `?division=${division}` : ''}`
          : null;
      return {
      season: r.season as number,
      round: r.event as number,
      track: resolveAccTrackName((r.track as string | null) ?? ''),
      date: r.event_date as string | null,
      position: r.finish_position as number,
      note: r.exclude_reason === 'Server crash' ? 'Server crash' : null,
        href,
      };
    });

  return { trend, recent };
}

async function getMileage(playerId: string): Promise<Mileage | null> {
  const [{ data, error }, carRows] = await Promise.all([
    supabase
      .from('driver_lap_totals')
      .select(
        'laps, valid_laps, sessions, first_seen, top_track_key, top_track_laps, top_car_model_id, top_car_laps, laps_rank, computed_at',
      )
      .eq('steam_id', playerId)
      .maybeSingle(),
    supabase
      .from('driver_car_laps')
      .select('car_model_id, laps')
      .eq('steam_id', playerId)
      .order('laps', { ascending: false }),
  ]);
  if (error) console.error('driver_lap_totals read failed:', error);
  if (carRows.error) console.error('driver_car_laps read failed:', carRows.error);
  if (!data || Number(data.laps) === 0) return null;
  const carTotal = (carRows.data ?? []).reduce((n, r) => n + Number(r.laps), 0);
  const cars: CarLaps[] = (carRows.data ?? []).map((r) => ({
    name: accCarModelName(Number(r.car_model_id)) ?? `Car #${r.car_model_id}`,
    laps: Number(r.laps),
    share: carTotal ? Number(r.laps) / carTotal : 0,
  }));
  return {
    cars,
    laps: Number(data.laps),
    validLaps: Number(data.valid_laps),
    sessions: Number(data.sessions),
    firstSeen: data.first_seen as string | null,
    topTrack: data.top_track_key ? resolveAccTrackName(data.top_track_key as string) : null,
    topTrackLaps: data.top_track_laps == null ? null : Number(data.top_track_laps),
    topCar: data.top_car_model_id == null ? null : accCarModelName(Number(data.top_car_model_id)),
    topCarLaps: data.top_car_laps == null ? null : Number(data.top_car_laps),
    lapsRank: Number(data.laps_rank),
    computedAt: data.computed_at as string,
  };
}

// The driver's placings on the Hot Lap (Seasonal) boards — every season,
// every track they set a lap on — ranked server-side by
// driver_hotlap_placings exactly as the board page ranks (see
// supabase/migrations/20261012b_driver_hotlap_placings.sql), then gated with
// seasonTrackAllowList: the same check the board route uses, so a profile
// never links (or leaks) a board for an unreleased round of the live season
// or a non-round track. Best placings first.
export async function getPlacings(playerId: string): Promise<Placing[]> {
  const { data, error } = await supabase.rpc('driver_hotlap_placings', { p_steam_id: playerId });
  if (error) console.error('driver_hotlap_placings failed:', error);
  const rows = (data ?? []) as Array<{
    season: string;
    track_key: string;
    car_model_id: number;
    best_lap_ms: number;
    is_wet: boolean;
    position: number;
    board_size: number;
  }>;

  const seasons = [...new Set(rows.map((r) => r.season))];
  const allow = new Map(
    await Promise.all(seasons.map(async (season) => [season, await seasonTrackAllowList(season)] as const)),
  );

  return rows
    .filter((r) => {
      const allowed = allow.get(r.season);
      return !allowed || allowed.has(r.track_key);
    })
    .map((r) => ({
      season: r.season,
      track: resolveAccTrackName(r.track_key),
      carClass: resolveCarGroup(r.car_model_id),
      car: accCarModelName(r.car_model_id),
      position: Number(r.position),
      boardSize: Number(r.board_size),
      bestLapMs: r.best_lap_ms,
      isWet: r.is_wet,
      href: `/acc/leaderboards/seasonal/${r.season}/${r.track_key}`,
    }))
    .sort((a, b) => a.position - b.position || b.boardSize - a.boardSize);
}

// Season number -> its GT3 championship's result-page base, for seasons the
// site has result pages for (S19 onward — earlier seasons predate the
// DB-backed championships and were never imported). Only a round that's on
// that championship's schedule links.
export async function resultLinkers(): Promise<Map<number, { slug: string; rounds: Set<number> }>> {
  const champs = (await getChampionships()).filter((c) => c.game === 'ACC' && !isEnduranceChampionship(c));
  const out = new Map<number, { slug: string; rounds: Set<number> }>();
  for (const c of champs) {
    const m = /^s(\d+)$/i.exec(c.registrationSeason ?? '');
    if (!m) continue;
    out.set(Number(m[1]), { slug: c.slug, rounds: new Set(c.schedule.map((r) => r.round)) });
  }
  return out;
}
