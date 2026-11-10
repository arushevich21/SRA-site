import 'server-only';
import { supabase } from '@/lib/supabase';
import { bareDriverName } from '@/lib/driver-display-name';

// About → Statistics. Everything here reads the nightly rollups
// (sra_stats_global, driver_lap_totals, driver_race_stats — see
// supabase/migrations/20261012_acc_lap_ledger_and_site_stats.sql), so every
// figure is as of the last 09:15 UTC refresh. ACC only, by decision.

export type SiteTotals = {
  laps: number;
  sessions: number;
  drivers: number;
  firstSessionAt: string | null;
  computedAt: string;
};

export type LeaderboardEntry = { rank: number; name: string; value: string; href?: string };
export type LeaderboardCategory = {
  key: string;
  label: string;
  valueLabel: string;
  entries: LeaderboardEntry[];
};

const BOARD_SIZE = 50;
const nf = new Intl.NumberFormat('en-US');

export async function getSiteTotals(): Promise<SiteTotals | null> {
  const { data, error } = await supabase
    .from('sra_stats_global')
    .select('laps, sessions, drivers, first_session_at, computed_at')
    .eq('id', 1)
    .maybeSingle();
  if (error) console.error('sra_stats_global read failed:', error);
  if (!data) return null;
  return {
    laps: Number(data.laps),
    sessions: Number(data.sessions),
    drivers: Number(data.drivers),
    firstSessionAt: data.first_session_at as string | null,
    computedAt: data.computed_at as string,
  };
}

type BoardRow = { playerId: string; fallbackName: string | null; value: number };

// Standard competition ranking (1, 2, 2, 4) so tied drivers share a rank.
function ranked(rows: BoardRow[]): Array<BoardRow & { rank: number }> {
  let rank = 0;
  return rows.map((r, i) => {
    if (i === 0 || rows[i - 1].value !== r.value) rank = i + 1;
    return { ...r, rank };
  });
}

async function lapsBoard(): Promise<BoardRow[]> {
  const { data, error } = await supabase
    .from('driver_lap_totals')
    .select('steam_id, driver_name, laps')
    .order('laps', { ascending: false })
    .order('steam_id', { ascending: true })
    .limit(BOARD_SIZE);
  if (error) console.error('driver_lap_totals board read failed:', error);
  return (data ?? []).map((r) => ({
    playerId: r.steam_id as string,
    fallbackName: (r.driver_name as string | null) ?? null,
    value: Number(r.laps),
  }));
}

async function raceBoard(column: 'wins' | 'podiums' | 'top10s'): Promise<BoardRow[]> {
  const { data, error } = await supabase
    .from('driver_race_stats')
    .select(`player_id, ${column}`)
    .eq('series', 'GT3')
    .gt(column, 0)
    .order(column, { ascending: false })
    .order('player_id', { ascending: true })
    .limit(BOARD_SIZE);
  if (error) console.error(`driver_race_stats ${column} board read failed:`, error);
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    playerId: r.player_id as string,
    fallbackName: null,
    value: Number(r[column]),
  }));
}

// Names + profile links for every driver on any board, in two reads.
// Board rows are S-prefixed; drivers.steam_id is bare (CLAUDE.md join rule).
// A driver with no drivers row keeps the name the ledger last saw in-game.
async function resolveDrivers(
  playerIds: string[],
): Promise<Map<string, { name: string; href?: string }>> {
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
  const [laps, wins, podiums, top10s] = await Promise.all([
    lapsBoard(),
    raceBoard('wins'),
    raceBoard('podiums'),
    raceBoard('top10s'),
  ]);
  const people = await resolveDrivers([...new Set([laps, wins, podiums, top10s].flat().map((r) => r.playerId))]);

  const toEntries = (rows: BoardRow[]): LeaderboardEntry[] =>
    ranked(rows).map((r) => {
      const who = people.get(r.playerId);
      return {
        rank: r.rank,
        name: who?.name ?? r.fallbackName ?? 'Unknown driver',
        value: nf.format(r.value),
        href: who?.href,
      };
    });

  return [
    { key: 'all-time-laps', label: 'All-Time Laps', valueLabel: 'Laps', entries: toEntries(laps) },
    { key: 'wins', label: 'Wins', valueLabel: 'Wins', entries: toEntries(wins) },
    { key: 'podiums', label: 'Podiums', valueLabel: 'Podiums', entries: toEntries(podiums) },
    { key: 'top-10s', label: 'Top 10s', valueLabel: 'Top 10s', entries: toEntries(top10s) },
  ].filter((c) => c.entries.length > 0);
}
