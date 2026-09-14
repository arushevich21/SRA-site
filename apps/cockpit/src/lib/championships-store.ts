import 'server-only';
import { supabase } from './supabase';
import { CHAMPIONSHIPS, type ChampionshipContent } from '@/content/championships';
import { mapChampionship, type AccsmTargetRow, type ChampionshipRow } from './championships-map';

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
  'round, track, race_length, starts_at, emperor_track, emperor_raw_track_name, hotlap_released, ' +
  // Per-division start overrides for split-night series — embedded rather than
  // fetched separately since PostgREST can walk the FK from championship_rounds.
  'championship_round_division_times(division_id, starts_at)';

// championship_accsm_targets keys on registration_key, not championships.id
// (see 20260825i for why that natural key was chosen), so it can't be pulled
// through the championships select as a nested relation — PostgREST has no FK
// from championships.id to walk. Hence a second query, keyed the same way.
const ACCSM_TARGET_COLS = 'registration_key, division_id, emperor_championship_id, divisions(name)';

type AccsmTargetRowWithKey = AccsmTargetRow & { registration_key: string };

// All division targets, grouped by the registration_key they belong to. A
// failure here is deliberately non-fatal: targets decorate a championship with
// its per-division GUIDs, and a championship with none simply renders as a
// single-championship event. Losing the whole championship list because this
// one auxiliary read failed would be a far worse outcome than losing the
// division tabs.
async function getAccsmTargetsByKey(): Promise<Map<string, AccsmTargetRow[]>> {
  const { data, error } = await supabase
    .from('championship_accsm_targets')
    .select(ACCSM_TARGET_COLS);

  const byKey = new Map<string, AccsmTargetRow[]>();
  if (error) {
    console.error('championship_accsm_targets read failed — division targets omitted:', error.message);
    return byKey;
  }

  for (const row of (data ?? []) as AccsmTargetRowWithKey[]) {
    // division_id is nullable on this table (20260826 made divisions optional
    // for single-grid events like LIAW, whose target row carries NULL). Such a
    // row says "this ACCSM championship is managed from Supabase", not "this is
    // division N" — it describes no division, so it can't become a tab.
    if (row.division_id == null) continue;
    const list = byKey.get(row.registration_key);
    if (list) list.push(row);
    else byKey.set(row.registration_key, [row]);
  }
  return byKey;
}

export async function getChampionships(): Promise<ChampionshipContent[]> {
  const [{ data, error }, targetsByKey] = await Promise.all([
    supabase
      .from('championships')
      .select(`*, championship_rounds(${ROUND_COLS})`)
      .order('sort_order', { ascending: true }),
    getAccsmTargetsByKey(),
  ]);

  if (error) {
    console.error('championships read failed — falling back to seed content:', error.message);
    return CHAMPIONSHIPS;
  }
  if (!data || data.length === 0) return CHAMPIONSHIPS;

  return (data as ChampionshipRow[]).map((row) =>
    mapChampionship(row, row.registration_key ? (targetsByKey.get(row.registration_key) ?? []) : []),
  );
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

// The division targets for one registration_key, division order — for
// pre-filling the edit form's "Division championships" rows. Separate from
// getAccsmTargetsByKey (which reads every key for the public render path) so
// the admin page fetches only the one event it is editing.
export async function getAccsmTargetsForKey(
  registrationKey: string,
): Promise<{ divisionId: number; emperorChampionshipId: string }[]> {
  const { data, error } = await supabase
    .from('championship_accsm_targets')
    .select('division_id, emperor_championship_id')
    .eq('registration_key', registrationKey)
    .order('division_id', { ascending: true });
  if (error) throw new Error(error.message);

  return (data ?? [])
    // A NULL division_id means "managed from Supabase, but not a division"
    // (LIAW's single-grid row, 20260826) — it isn't an editable division row.
    .filter((r) => r.division_id != null)
    .map((r) => ({
      divisionId: r.division_id as number,
      emperorChampionshipId: r.emperor_championship_id as string,
    }));
}

// The series-level race-night rule, for pre-filling the admin form. Only
// divisions that race LATER than the round date have a row; the form renders
// every division and treats a missing one as offset 0.
export async function getRaceNightsForChampionship(
  championshipId: string,
): Promise<{ divisionId: number; dayOffset: number }[]> {
  const { data, error } = await supabase
    .from('championship_division_nights')
    .select('division_id, day_offset')
    .eq('championship_id', championshipId)
    .order('division_id', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    divisionId: r.division_id as number,
    dayOffset: r.day_offset as number,
  }));
}

// Division list for the admin form's division picker.
export async function getDivisions(): Promise<{ id: number; name: string }[]> {
  const { data, error } = await supabase.from('divisions').select('id, name').order('id');
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: number; name: string }[];
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
