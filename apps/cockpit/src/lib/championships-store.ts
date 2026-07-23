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

export async function getChampionships(): Promise<ChampionshipContent[]> {
  const { data, error } = await supabase
    .from('championships')
    .select(
      '*, championship_rounds(round, track, race_length, starts_at, emperor_track, emperor_raw_track_name)',
    )
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('championships read failed — falling back to seed content:', error.message);
    return CHAMPIONSHIPS;
  }
  if (!data || data.length === 0) return CHAMPIONSHIPS;

  return (data as ChampionshipRow[]).map(mapChampionship);
}
