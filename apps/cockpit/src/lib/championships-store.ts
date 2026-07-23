import 'server-only';
import { supabase } from './supabase';
import { CHAMPIONSHIPS, type ChampionshipContent } from '@/content/championships';
import { mapChampionship, type ChampionshipRow } from './championships-map';

// Phase 1 of the DB-backed events feature: championship/event content now
// lives in Supabase (see supabase/migrations/20260721_championships.sql). The
// render layer still consumes ChampionshipContent objects — this reads the
// rows and maps them back to that shape, so call-sites only change from
// `import { CHAMPIONSHIPS }` to `await getChampionships()`.
//
// Safety net during the migration: if the DB is unreachable OR has not been
// seeded yet (empty), fall back to the in-repo CHAMPIONSHIPS constant. That
// makes this a zero-behaviour-change swap — the site renders identically
// before and after the seed runs. Once fully DB-driven this fallback can be
// revisited (an empty table would then be a real, visible state).

const ROUND_COLS =
  'round, track, race_length, starts_at, emperor_track, emperor_raw_track_name';

export async function getChampionships(): Promise<ChampionshipContent[]> {
  const { data, error } = await supabase
    .from('championships')
    .select(`*, championship_rounds(${ROUND_COLS})`)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('championships read failed — falling back to seed content:', error.message);
    return CHAMPIONSHIPS;
  }
  if (!data || data.length === 0) return CHAMPIONSHIPS;

  return (data as ChampionshipRow[]).map(mapChampionship);
}

// ── Admin reads (include the DB id, never exposed to the public render layer) ──

export type ChampionshipAdminSummary = {
  id: string;
  slug: string;
  game: string;
  title: string;
  sortOrder: number;
  teaserOnly: boolean;
  concluded: boolean;
  roundCount: number;
};

export async function getChampionshipAdminList(): Promise<ChampionshipAdminSummary[]> {
  const { data, error } = await supabase
    .from('championships')
    .select('id, slug, game, title, sort_order, teaser_only, concluded, championship_rounds(round)')
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    id: r.id as string,
    slug: r.slug as string,
    game: r.game as string,
    title: r.title as string,
    sortOrder: r.sort_order as number,
    teaserOnly: r.teaser_only as boolean,
    concluded: r.concluded as boolean,
    roundCount: (r.championship_rounds as unknown[] | null)?.length ?? 0,
  }));
}

// Full row (incl id + rounds) for pre-filling the edit form.
export async function getChampionshipRowById(
  id: string,
): Promise<(ChampionshipRow & { id: string }) | null> {
  const { data, error } = await supabase
    .from('championships')
    .select(`*, championship_rounds(${ROUND_COLS})`)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as (ChampionshipRow & { id: string }) | null) ?? null;
}
