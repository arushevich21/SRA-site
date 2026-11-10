import 'server-only';
import { supabase } from '@/lib/supabase';
import type { DriverTier } from '@/lib/driver-tier-badge';

// About → Drivers & Stats. Both reads are SQL functions (see
// supabase/migrations/20261012c_driver_directory.sql) — the directory sorts
// on columns from three sources PostgREST can't join, and the overview needs
// GROUP BYs. Sorting/paging stay in the database.

export const DIRECTORY_SORTS = {
  wins: 'Most wins',
  starts: 'Most starts',
  podiums: 'Most podiums',
  rating: 'SRAting',
  name: 'Name (A–Z)',
  number: 'Driver number',
} as const;
export type DirectorySort = keyof typeof DIRECTORY_SORTS;

export const DIRECTORY_PAGE_SIZE = 50;

export type DirectoryRow = {
  id: string;
  displayName: string;
  driverNumber: number | null;
  country: string | null;
  division: number | null;
  tier: DriverTier | null;
  isSralien: boolean;
  starts: number | null;
  wins: number | null;
  podiums: number | null;
  composite: number | null;
};

export type DirectoryPage = { rows: DirectoryRow[]; total: number };

export function parseDirectorySort(raw: string | undefined): DirectorySort {
  return raw && raw in DIRECTORY_SORTS ? (raw as DirectorySort) : 'wins';
}

export async function getDriverDirectory(opts: {
  search: string;
  sort: DirectorySort;
  division: number | null;
  page: number;
}): Promise<DirectoryPage> {
  const { data, error } = await supabase.rpc('driver_directory', {
    p_search: opts.search || null,
    p_sort: opts.sort,
    p_division: opts.division,
    p_limit: DIRECTORY_PAGE_SIZE,
    p_offset: (opts.page - 1) * DIRECTORY_PAGE_SIZE,
  });
  if (error) {
    console.error('driver_directory failed:', error);
    return { rows: [], total: 0 };
  }
  const raw = (data ?? []) as Array<Record<string, unknown>>;
  return {
    total: raw.length ? Number(raw[0].total_count) : 0,
    rows: raw.map((r) => ({
      id: r.id as string,
      displayName: r.display_name as string,
      driverNumber: r.driver_number as number | null,
      country: r.country as string | null,
      division: r.division_id as number | null,
      tier: r.tier as DriverTier | null,
      isSralien: r.is_sralien as boolean,
      starts: r.starts == null ? null : Number(r.starts),
      wins: r.wins == null ? null : Number(r.wins),
      podiums: r.podiums == null ? null : Number(r.podiums),
      composite: r.composite == null ? null : Number(r.composite),
    })),
  };
}

export type DriversOverview = {
  numbered: number;
  withResults: number;
  inDivision: number;
  withCountry: number;
  countries: Array<{ country: string; count: number }>;
  divisions: Array<{ division: number; total: number; gold: number; silver: number; sralien: number }>;
};

export async function getDriversOverview(): Promise<DriversOverview | null> {
  const { data, error } = await supabase.rpc('drivers_overview');
  if (error || !data) {
    console.error('drivers_overview failed:', error);
    return null;
  }
  const o = data as Record<string, unknown>;
  return {
    numbered: Number(o.numbered),
    withResults: Number(o.with_results),
    inDivision: Number(o.in_division),
    withCountry: Number(o.with_country),
    countries: (o.countries as DriversOverview['countries']) ?? [],
    divisions: (o.divisions as DriversOverview['divisions']) ?? [],
  };
}
