import 'server-only';
import { supabase as adminClient } from './supabase';

// GT3 Team Series championship_key family, e.g. 'acc-gt3-s19'. Activity for the
// purge is measured across this series' seasons. Adjust if the key scheme changes.
const TEAM_SERIES_PREFIX = 'acc-gt3-';
const SEASON_WINDOW = 3;
// "Inactive for 2 of the last 3 seasons" => active in fewer than 2 of them.
const MIN_ACTIVE_SEASONS = 2;

// Seasons are 's19', 's7', … — order by the embedded number, not lexically.
function seasonNum(season: string): number {
  const m = /(\d+)/.exec(season);
  return m ? parseInt(m[1], 10) : -1;
}

function displayName(d: {
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
}): string {
  const full = [d.first_name, d.last_name].filter(Boolean).join(' ').trim();
  if (full) return full;
  return (d.display_name ?? '').split('┊')[0].trim() || '—';
}

export type PurgeCandidate = {
  id: string;
  name: string;
  number: number;
  activeCount: number;
};

export type PurgeData =
  | { ready: false; seasonCount: number } // not enough team-series history yet
  | { ready: true; seasons: string[]; candidates: PurgeCandidate[] };

/**
 * Compute purge candidates: numbered drivers inactive in ≥2 of the last 3
 * team-series seasons. Exempts admins, preserve_driver_number, and the champion
 * (#1 / anyone holding a reserved prior_driver_number). Read-only.
 */
export async function getPurgeData(): Promise<PurgeData> {
  const { data: members } = await adminClient
    .from('team_members')
    .select('driver_id, season')
    .like('championship_key', `${TEAM_SERIES_PREFIX}%`);

  const rows = members ?? [];
  const seasonRank = new Map<string, number>();
  for (const m of rows) seasonRank.set(m.season, seasonNum(m.season));

  const seasons = [...seasonRank.keys()]
    .sort((a, b) => seasonRank.get(b)! - seasonRank.get(a)!)
    .slice(0, SEASON_WINDOW);

  if (seasons.length < SEASON_WINDOW) {
    return { ready: false, seasonCount: seasons.length };
  }

  const window = new Set(seasons);
  const active = new Map<string, Set<string>>(); // driver_id -> seasons active in
  for (const m of rows) {
    if (!window.has(m.season)) continue;
    (active.get(m.driver_id) ?? active.set(m.driver_id, new Set()).get(m.driver_id)!).add(
      m.season,
    );
  }

  // Only numbered drivers can be purged (≤999 rows, under PostgREST's 1000 cap).
  const { data: drivers } = await adminClient
    .from('drivers')
    .select(
      'id, first_name, last_name, display_name, driver_number, is_admin, preserve_driver_number, prior_driver_number',
    )
    .not('driver_number', 'is', null);

  const candidates: PurgeCandidate[] = [];
  for (const d of drivers ?? []) {
    if (d.driver_number === 1) continue; // champion #1
    if (d.prior_driver_number != null) continue; // holds a reserved number
    if (d.is_admin) continue; // admins' numbers are preserved
    if (d.preserve_driver_number === true) continue; // marked immune
    const count = active.get(d.id)?.size ?? 0;
    if (count < MIN_ACTIVE_SEASONS) {
      candidates.push({
        id: d.id,
        name: displayName(d),
        number: d.driver_number as number,
        activeCount: count,
      });
    }
  }

  candidates.sort((a, b) => a.number - b.number);
  return { ready: true, seasons, candidates };
}
