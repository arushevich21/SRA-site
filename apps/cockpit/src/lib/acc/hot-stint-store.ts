import 'server-only';
import { supabase } from '../supabase';

// Hot Stint Qualifying data is owned by an external bot, not this codebase
// (see supabase/migrations/20260814_drop_hot_stint_ingest.sql for why the
// acc-web ingest built for this was dropped). The bot writes
// acc_hotstint_leaderboard (qualifying=true rows) and classification, which
// classification_status joins into one row per driver per (series, season).
//
// ── PRIVACY — the real enforcement point is the schema, not this file:
// classification_status_public (see 20260814b_classification_hotstint_public.sql)
// is a security_invoker view that was never given the admin-only columns, so
// select('*') against it is structurally incapable of returning them — that
// holds regardless of what any query in this codebase does, including the
// fact that every query here (public and admin alike) runs on the same
// service-role client, which bypasses RLS. classification_status itself had
// exactly this gap until this investigation found it live: no
// security_invoker, plus a default anon/authenticated grant, meaning the
// view ran as its owner and skipped classification_status's RLS entirely —
// exposing discord_id/steam_id/real names/num_laps/rating internals via the
// public anon key. That's now fixed at the classification_status view
// itself (security_invoker + explicit revoke) AND classification_status_public
// repeats the same two-layer fix independently, rather than assuming the
// upstream fix is enough on its own.
//
// PUBLIC_CLASSIFICATION_COLUMNS/ADMIN_ONLY_CLASSIFICATION_COLUMNS below are a
// belt-and-braces app-layer mirror of the same split, checked against each
// other by hot-stint-store.test.ts — not the primary defense.
export const PUBLIC_CLASSIFICATION_COLUMNS = [
  'series',
  'season',
  'first_name',
  'last_name',
  'hotstint_ms',
  // Which car produced the driver's winning stint average — not PII, safe
  // alongside the name/time columns above. See 20260825_classification_
  // status_car_model.sql for where these come from (best_quali carries
  // acc_hotstint_leaderboard's own car_model_id/car_model straight through —
  // no separate join needed).
  'car_model_id',
  'car_model',
  // Moved from admin-only 2026-08-25: the actual hard requirement was
  // always just "lap counts stay hidden" (num_laps, below) — steam_id isn't
  // PII in the sense that mattered here, and every other public ACC
  // leaderboard already ships it over the wire (used for row identity and
  // the "My Laps" filter — see HotLapBoard.tsx). Confirmed with the product
  // owner before moving it; discord_id/driver_id/rating internals stayed
  // admin-only on purpose, this wasn't a blanket loosening.
  'steam_id',
  // Per-sector average across the winning 5-lap stint (same meaning as
  // hotstint_ms is the overall average), plus car_group/track_key needed to
  // gate and compute the reference-time tier badge client-side — see
  // lib/acc/reference-times.ts's classifyLapTier. None are PII.
  'sectors_ms',
  'car_group',
  'track_key',
] as const;

export const ADMIN_ONLY_CLASSIFICATION_COLUMNS = [
  'discord_id',
  'driver_id',
  'has_signup',
  'has_account',
  'has_hotstint',
  'eligible',
  'num_laps',
  'is_returning',
  'srating_ordinal',
  'composite',
  'pace_pct',
] as const;

// Every column that exists on classification_status — independently
// transcribed from the view's definition (supabase/schema.sql), NOT derived
// from PUBLIC/ADMIN_ONLY above. hot-stint-store.test.ts asserts PUBLIC ∪
// ADMIN_ONLY equals this set exactly, so a column added to
// classification_status without being classified into one of the two lists
// above fails the test instead of silently landing in neither. Deriving this
// list from the other two would make that test vacuous — it MUST be
// authored independently to catch a real drift. (Found already-vacuous
// during the 2026-08-25 car-column change — this literal array is the fix,
// not a spread of the two lists above.)
export const ALL_CLASSIFICATION_STATUS_COLUMNS = [
  'series',
  'season',
  'discord_id',
  'driver_id',
  'steam_id',
  'first_name',
  'last_name',
  'has_signup',
  'has_account',
  'has_hotstint',
  'eligible',
  'hotstint_ms',
  'num_laps',
  'is_returning',
  'srating_ordinal',
  'composite',
  'pace_pct',
  'car_model_id',
  'car_model',
  'sectors_ms',
  'car_group',
  'track_key',
] as const;

export type ClassificationScope = { series: string; season: number };

// The one classification run currently in progress — picked as the newest
// (series, season) pair present in `classification`, the bot-owned table
// classification_status joins against. There's exactly one such run at a
// time in practice (a new season's classification doesn't start until the
// prior one is done), so "newest" is an unambiguous "current" rather than a
// judgment call about which of several to show. Returns null if the bot
// hasn't written anything yet (e.g. between seasons).
export async function getCurrentClassificationScope(): Promise<ClassificationScope | null> {
  const { data, error } = await supabase
    .from('classification')
    .select('series, season')
    .order('season', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('Classification scope lookup failed:', error);
    return null;
  }
  if (!data) return null;
  return { series: data.series as string, season: data.season as number };
}

// Whether the Hot Stint Qualifying tab should be shown at all: whether a
// classification run is currently in progress. Deliberately NOT gated on
// having at least one eligible row — a near-empty board early in a
// classification window is expected, correct, and still worth showing
// (drivers watching for their own time to land), not a reason to hide the
// tab.
export async function hasHotStintQualifyingContent(): Promise<boolean> {
  return (await getCurrentClassificationScope()) !== null;
}

export type PublicHotStintRow = {
  position: number;
  steamId: string;
  driverName: string;
  hotstintMs: number;
  // Naming matches AccHotLapEntry (shared-types/acc.ts): carModel is the raw
  // numeric id (icon/logo lookups), carModelName the display string.
  carModel: number | null;
  carModelName: string | null;
  sectorsMs: number[] | null;
  carGroup: string | null;
  trackKey: string | null;
};

// Public "Hot Stint Qualifying (seasonal)" leaderboard tab. Reads
// classification_status_public (a view, not classification_status directly)
// and is deliberately a separate query from getAdminClassificationHotStint,
// not the same query with columns hidden in the UI, which would still ship
// them in the network response.
//
// One row per (driver, car) qualifying stint — NOT collapsed to each
// driver's single best (that collapse is HotLapBoard's client-side "Unique
// Drivers" toggle, same as every other Hot Stint/Hot Lap board; baking it
// into the query was a mistake caught and fixed 2026-08-25, see
// 20260825b_classification_public_all_stints.sql). The view's join is what
// gates who appears at all: a driver needs completed signup, a linked
// steam_id, AND at least one qualifying stint (the inner join to
// acc_hotstint_leaderboard itself is the has_hotstint condition) — a driver
// who set a time without completing classification signup doesn't show
// ranked here and then vanish once divisions publish. See the view's
// migration for the full reasoning.
export async function getPublicHotStintLeaderboard(
  series: string,
  season: number,
): Promise<PublicHotStintRow[]> {
  const { data, error } = await supabase
    .from('classification_status_public')
    .select(PUBLIC_CLASSIFICATION_COLUMNS.join(', '))
    .eq('series', series)
    .eq('season', season)
    .order('hotstint_ms', { ascending: true });
  if (error) throw error;

  return ((data ?? []) as unknown as Array<{
    steam_id: string;
    first_name: string | null;
    last_name: string | null;
    hotstint_ms: number;
    car_model_id: number | null;
    car_model: string | null;
    sectors_ms: number[] | null;
    car_group: string | null;
    track_key: string | null;
  }>).map((r, i) => ({
    position: i + 1,
    steamId: r.steam_id,
    driverName: [r.first_name, r.last_name].filter(Boolean).join(' ') || 'Unknown',
    hotstintMs: r.hotstint_ms,
    carModel: r.car_model_id,
    carModelName: r.car_model,
    sectorsMs: r.sectors_ms,
    carGroup: r.car_group,
    trackKey: r.track_key,
  }));
}

// Emil Frey Jaguar G3 — see content/acc-car-model-map.ts's
// ACC_CAR_MODEL_ID_BY_NAME (the human-confirmed source of truth for this
// id). Hardcoded here rather than importing that map, which is keyed by
// championships.ts's allowedCars picker strings and pulls in content-layer
// deps this file has no other reason to depend on — the id itself is
// unambiguous and stable (see acc-constants.ts).
const JAGUAR_CAR_MODEL_ID = 14;

export type JagoffRow = {
  position: number;
  steamId: string;
  driverName: string;
  hotstintMs: number;
  sectorsMs: number[] | null;
  trackKey: string | null;
};

// #Jagoff: an in-house side-competition for the fastest Hot Stint average
// specifically in the Jaguar (car_model_id 14), scoped to the current
// classification season — same season the main Hot Stint Qualifying board
// uses, so "this season's Jagoff winner" means the same season as
// everything else on the page. Reads acc_hotstint_leaderboard directly
// rather than classification_status_public: this board isn't gated on
// classification eligibility (has_signup/linked account) at all — it's a
// fun side board open to anyone who set a qualifying Jaguar stint,
// classified or not — and it's fixed to one car by construction, so there's
// no "collapse across cars" question here the way there is on the main
// board (see getPublicHotStintLeaderboard above).
export async function getJagoffBoard(scope: ClassificationScope): Promise<JagoffRow[]> {
  const { data, error } = await supabase
    .from('acc_hotstint_leaderboard')
    .select('steam_id, driver_name, best_stint_ms, sectors_ms, track_key')
    .eq('board_scope', 'seasonal')
    .eq('qualifying', true)
    .eq('is_wet', false)
    .eq('car_model_id', JAGUAR_CAR_MODEL_ID)
    .eq('season', `S${scope.season}`)
    .order('best_stint_ms', { ascending: true });
  if (error) throw error;

  // One row per driver — best Jaguar stint only. Rows already arrive
  // best-first, so the first occurrence of a steam_id wins.
  const seen = new Set<string>();
  const rows: JagoffRow[] = [];
  for (const r of (data ?? []) as Array<{
    steam_id: string;
    driver_name: string;
    best_stint_ms: number;
    sectors_ms: number[] | null;
    track_key: string | null;
  }>) {
    if (seen.has(r.steam_id)) continue;
    seen.add(r.steam_id);
    rows.push({
      position: rows.length + 1,
      steamId: r.steam_id,
      driverName: r.driver_name,
      hotstintMs: r.best_stint_ms,
      sectorsMs: r.sectors_ms,
      trackKey: r.track_key,
    });
  }
  return rows;
}

// Whether the #Jagoff tab should be shown: unlike Hot Stint Qualifying
// (shown for the whole classification window, even empty), Jagoff is a
// narrow side board — only worth a nav entry once someone has actually set
// a qualifying Jaguar stint this season.
export async function hasJagoffContent(): Promise<boolean> {
  const scope = await getCurrentClassificationScope();
  if (!scope) return false;
  return (await getJagoffBoard(scope)).length > 0;
}

// Per-driver nudge for the public Hot Stint Qualifying page: which half of
// classification a specific driver is missing, if either. Reads
// classification_status directly (not classification_status_public), since
// has_signup/has_hotstint are admin-only columns — safe here ONLY because
// every call site resolves steamId from the caller's own auth session
// server-side first (see hotstint-qualifying/actions.ts's
// getMyClassificationSignupNotice) and never accepts it as client input;
// this function itself does no such check, same trust boundary as every
// other function in this file that reads classification_status directly.
export type ClassificationSignupState =
  | 'signed_up_no_stint'
  | 'stint_no_signup'
  | 'complete'
  | null;

export async function getClassificationSignupState(
  steamId: string,
  series: string,
  season: number,
): Promise<ClassificationSignupState> {
  const { data, error } = await supabase
    .from('classification_status')
    .select('has_signup, has_hotstint')
    .eq('steam_id', steamId)
    .eq('series', series)
    .eq('season', season)
    .maybeSingle();
  if (error) {
    console.error('Classification signup state lookup failed:', error);
    return null;
  }
  if (!data) return null;
  const { has_signup, has_hotstint } = data as { has_signup: boolean; has_hotstint: boolean };
  if (has_signup && has_hotstint) return 'complete';
  if (has_signup && !has_hotstint) return 'signed_up_no_stint';
  if (!has_signup && has_hotstint) return 'stint_no_signup';
  return null;
}

export type AdminHotStintRow = {
  position: number;
  driverName: string;
  discordId: string;
  driverId: string | null;
  steamId: string | null;
  hasSignup: boolean;
  hasAccount: boolean;
  hasHotstint: boolean;
  eligible: boolean;
  hotstintMs: number | null;
  numLaps: number | null;
  isReturning: boolean;
  sratingOrdinal: number | null;
  composite: number | null;
  pacePct: number | null;
  carModel: number | null;
  carModelName: string | null;
  sectorsMs: number[] | null;
  carGroup: string | null;
  trackKey: string | null;
};

// Admin-only view of the full classification run for (series, season) —
// every column, including the ones classification_status_public never
// exposes. Reads classification_status directly through the service-role
// client; no separate admin-only view object is needed since that table is
// already RLS/grant-protected on its own. Never called from a public-facing
// route. Includes drivers with no hotstint_ms yet (unlike the public
// leaderboard) — admins need to see who hasn't run, not just who's ranked.
export async function getAdminClassificationHotStint(
  series: string,
  season: number,
): Promise<AdminHotStintRow[]> {
  const { data, error } = await supabase
    .from('classification_status')
    .select('*')
    .eq('series', series)
    .eq('season', season)
    .order('hotstint_ms', { ascending: true, nullsFirst: false });
  if (error) throw error;

  return (data ?? []).map((r, i) => ({
    position: i + 1,
    driverName: [r.first_name, r.last_name].filter(Boolean).join(' ') || 'Unknown',
    discordId: r.discord_id as string,
    driverId: r.driver_id as string | null,
    steamId: r.steam_id as string | null,
    hasSignup: r.has_signup as boolean,
    hasAccount: r.has_account as boolean,
    hasHotstint: r.has_hotstint as boolean,
    eligible: r.eligible as boolean,
    hotstintMs: r.hotstint_ms as number | null,
    numLaps: r.num_laps as number | null,
    isReturning: r.is_returning as boolean,
    sratingOrdinal: r.srating_ordinal as number | null,
    composite: r.composite as number | null,
    pacePct: r.pace_pct as number | null,
    carModel: r.car_model_id as number | null,
    carModelName: r.car_model as string | null,
    sectorsMs: r.sectors_ms as number[] | null,
    carGroup: r.car_group as string | null,
    trackKey: r.track_key as string | null,
  }));
}
