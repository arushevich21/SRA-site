import 'server-only';
import { accCarModelName } from '@sra/domain';
import { supabase } from '@/lib/supabase';
import { bareDriverName } from '@/lib/driver-display-name';
import { resolveAccTrackName } from '@/lib/acc/track-name';

// About → Statistics. Everything here reads the nightly rollups
// (sra_stats_global, driver_lap_totals, driver_race_stats, driver_pole_stats,
// site_track_laps, site_car_laps — see
// supabase/migrations/20261012_acc_lap_ledger_and_site_stats.sql and
// 20261110_site_stats_km_poles_tracks_cars.sql), so every figure is as of
// the last 09:15 UTC refresh. ACC only, by decision. Any board whose rollup
// is empty or missing is simply left off the page.

export type SiteTotals = {
  laps: number;
  sessions: number;
  drivers: number;
  km: number | null; // null until the km migration has run
  firstSessionAt: string | null;
  computedAt: string;
};

export type LeaderboardEntry = { rank: number; name: string; value: string; href?: string };
export type LeaderboardCategory = {
  key: string;
  label: string;
  subjectLabel: string; // first column header: Driver / Track / Car
  valueLabel: string;
  entries: LeaderboardEntry[];
};

const BOARD_SIZE = 50;
const nf = new Intl.NumberFormat('en-US');

export async function getSiteTotals(): Promise<SiteTotals | null> {
  // select('*') so the page keeps working before/after km exists.
  const { data, error } = await supabase.from('sra_stats_global').select('*').eq('id', 1).maybeSingle();
  if (error) console.error('sra_stats_global read failed:', error);
  if (!data) return null;
  return {
    laps: Number(data.laps),
    sessions: Number(data.sessions),
    drivers: Number(data.drivers),
    km: data.km == null ? null : Number(data.km),
    firstSessionAt: data.first_session_at as string | null,
    computedAt: data.computed_at as string,
  };
}

type Row = { id: string; fallbackName: string | null; value: number };

// Standard competition ranking (1, 2, 2, 4) so ties share a rank.
function ranked<T extends { value: number }>(rows: T[]): Array<T & { rank: number }> {
  let rank = 0;
  return rows.map((r, i) => {
    if (i === 0 || rows[i - 1].value !== r.value) rank = i + 1;
    return { ...r, rank };
  });
}

// Top-N of one numeric column of a per-driver rollup. Board rows are keyed
// by S-prefixed SteamID (idColumn).
async function driverBoard(
  table: string,
  idColumn: string,
  column: string,
  opts: { nameColumn?: string; series?: string } = {},
): Promise<Row[]> {
  const cols = [idColumn, column, opts.nameColumn].filter(Boolean).join(', ');
  let q = supabase.from(table).select(cols);
  if (opts.series) q = q.eq('series', opts.series);
  const { data, error } = await q
    .gt(column, 0)
    .order(column, { ascending: false })
    .order(idColumn, { ascending: true })
    .limit(BOARD_SIZE);
  if (error) console.error(`${table}.${column} board read failed:`, error);
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: r[idColumn] as string,
    fallbackName: opts.nameColumn ? ((r[opts.nameColumn] as string | null) ?? null) : null,
    value: Number(r[column]),
  }));
}

// Track/car boards: the whole (small) rollup, already one row per subject.
async function subjectBoard(table: string, idColumn: string): Promise<Array<{ id: string; value: number }>> {
  const { data, error } = await supabase
    .from(table)
    .select(`${idColumn}, laps`)
    .order('laps', { ascending: false })
    .limit(BOARD_SIZE);
  if (error) console.error(`${table} board read failed:`, error);
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: String(r[idColumn]),
    value: Number(r.laps),
  }));
}

// Names + profile links for every driver on any board, in two reads.
// Board rows are S-prefixed; drivers.steam_id is bare (CLAUDE.md join rule).
// A driver with no drivers row keeps the name the ledger last saw in-game.
async function resolveDrivers(playerIds: string[]): Promise<Map<string, { name: string; href?: string }>> {
  const out = new Map<string, { name: string; href?: string }>();
  if (playerIds.length === 0) return out;
  const bare = playerIds.map((p) => p.slice(1));
  const [drivers, names] = await Promise.all([
    supabase.from('drivers').select('id, steam_id, display_name').in('steam_id', bare),
    supabase.from('acc_driver_names').select('steam_id, driver_name').in('steam_id', playerIds),
  ]);
  if (drivers.error) console.error('drivers name read failed:', drivers.error);
  if (names.error) console.error('acc_driver_names read failed:', names.error);
  for (const n of names.data ?? []) {
    out.set(n.steam_id as string, { name: n.driver_name as string });
  }
  for (const d of drivers.data ?? []) {
    if (!d.steam_id) continue;
    out.set(`S${d.steam_id}`, {
      name: bareDriverName(d.display_name as string),
      href: `/drivers/${d.id as string}`,
    });
  }
  return out;
}

export async function getStatsLeaderboards(): Promise<LeaderboardCategory[]> {
  const [laps, wins, podiums, top10s, poles, tracks, cars] = await Promise.all([
    driverBoard('driver_lap_totals', 'steam_id', 'laps', { nameColumn: 'driver_name' }),
    driverBoard('driver_race_stats', 'player_id', 'wins', { series: 'GT3' }),
    driverBoard('driver_race_stats', 'player_id', 'podiums', { series: 'GT3' }),
    driverBoard('driver_race_stats', 'player_id', 'top10s', { series: 'GT3' }),
    driverBoard('driver_pole_stats', 'player_id', 'poles'),
    subjectBoard('site_track_laps', 'track_key'),
    subjectBoard('site_car_laps', 'car_model_id'),
  ]);
  const people = await resolveDrivers([
    ...new Set([laps, wins, podiums, top10s, poles].flat().map((r) => r.id)),
  ]);

  const driverEntries = (rows: Row[]): LeaderboardEntry[] =>
    ranked(rows).map((r) => {
      const who = people.get(r.id);
      return {
        rank: r.rank,
        name: who?.name ?? r.fallbackName ?? 'Unknown driver',
        value: nf.format(r.value),
        href: who?.href,
      };
    });
  const subjectEntries = (rows: Array<{ id: string; value: number }>, name: (id: string) => string) =>
    ranked(rows).map((r) => ({ rank: r.rank, name: name(r.id), value: nf.format(r.value) }));

  const boards: LeaderboardCategory[] = [
    { key: 'all-time-laps', label: 'All-Time Laps', subjectLabel: 'Driver', valueLabel: 'Laps', entries: driverEntries(laps) },
    { key: 'wins', label: 'Wins', subjectLabel: 'Driver', valueLabel: 'Wins', entries: driverEntries(wins) },
    { key: 'podiums', label: 'Podiums', subjectLabel: 'Driver', valueLabel: 'Podiums', entries: driverEntries(podiums) },
    { key: 'top-10s', label: 'Top 10s', subjectLabel: 'Driver', valueLabel: 'Top 10s', entries: driverEntries(top10s) },
    { key: 'poles', label: 'Pole Positions', subjectLabel: 'Driver', valueLabel: 'Poles', entries: driverEntries(poles) },
    {
      key: 'tracks',
      label: 'Tracks',
      subjectLabel: 'Track',
      valueLabel: 'Laps',
      entries: subjectEntries(tracks, (k) => resolveAccTrackName(k)),
    },
    {
      key: 'cars',
      label: 'Cars',
      subjectLabel: 'Car',
      valueLabel: 'Laps',
      entries: subjectEntries(cars, (id) => accCarModelName(Number(id)) ?? `Car #${id}`),
    },
  ];
  return boards.filter((b) => b.entries.length > 0);
}
