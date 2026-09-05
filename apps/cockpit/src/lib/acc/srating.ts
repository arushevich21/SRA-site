import 'server-only';
import { supabase } from '@/lib/supabase';
import type { DriverTier } from '@/lib/driver-lookup';

export type SRatingRow = {
  rank: number;
  playerId: string;
  driverId: string;
  displayName: string;
  // Alien status here is defined by this leaderboard's own top 10, not the
  // (possibly stale/legacy) drivers.is_sralien flag — see driver-tier-badge.ts.
  isSralien: boolean;
  division: number | null;
  tier: DriverTier | null;
  composite: number | null;
  pace: number | null;
  pacePct: number | null;
  osPct: number | null;
  numRaces: number | null;
  lastSeason: number | null;
};

export type SRatingData = {
  rows: SRatingRow[];
  // driver_ratings.computed_at — all rows share one value (a single external
  // pipeline run), so this is just the first row's, not an aggregate.
  computedAt: string | null;
};

export const ENGINE = 'v2-openskill';
export const ALIEN_CUTOFF_RANK = 10;

// drivers.display_name embeds the driver's number as a "┊{number}" suffix
// (see driver-display-name.ts) — this board shows names only, no numbers, so
// strip it the same way driver-numbers.ts does rather than rendering it raw.
function bareName(displayName: string): string {
  return displayName.split('┊')[0].trim() || displayName;
}

type RawRatingJoin = {
  player_id: string;
  composite: number | null;
  pace: number | null;
  pace_pct: number | null;
  os_pct: number | null;
  num_races: number | null;
  last_season: number | null;
  computed_at: string;
  drivers: {
    id: string;
    display_name: string;
    division_id: number | null;
    tier: DriverTier | null;
  } | null;
};

// Public SRAting v2 leaderboard. Display only — driver_ratings is populated
// by an external pipeline, never written to from the site. `drivers!inner`
// excludes rows with no linked driver (unresolved player_id) rather than
// showing a fallback label, so every row here has a real display name.
export async function getSRatingData(): Promise<SRatingData> {
  const { data, error } = await supabase
    .from('driver_ratings')
    .select(
      'player_id, composite, pace, pace_pct, os_pct, num_races, last_season, computed_at, drivers!inner(id, display_name, division_id, tier)',
    )
    .eq('engine', ENGINE)
    .order('composite', { ascending: false, nullsFirst: false });

  if (error || !data) return { rows: [], computedAt: null };

  const raw = data as unknown as RawRatingJoin[];

  const rows = raw.map((r, i) => {
    const rank = i + 1;
    return {
      rank,
      playerId: r.player_id,
      driverId: r.drivers?.id ?? '',
      displayName: r.drivers?.display_name ? bareName(r.drivers.display_name) : '—',
      isSralien: rank <= ALIEN_CUTOFF_RANK,
      division: r.drivers?.division_id ?? null,
      tier: r.drivers?.tier ?? null,
      composite: r.composite,
      pace: r.pace,
      pacePct: r.pace_pct,
      osPct: r.os_pct,
      numRaces: r.num_races,
      lastSeason: r.last_season,
    };
  });

  return { rows, computedAt: raw[0]?.computed_at ?? null };
}

// Rendered server-side, so the zone must be pinned explicitly (see
// lib/event-time.ts) — otherwise it'd resolve to the server's runtime zone
// (UTC on Vercel) instead of a consistent, human one for every visitor.
export function formatComputedAt(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone: 'America/New_York',
  });
}
