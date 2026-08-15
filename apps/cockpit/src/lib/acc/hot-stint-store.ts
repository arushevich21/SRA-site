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
] as const;

export const ADMIN_ONLY_CLASSIFICATION_COLUMNS = [
  'discord_id',
  'driver_id',
  'steam_id',
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
// above fails the test instead of silently landing in neither. (Deriving
// this list from the other two would make that test vacuous — it must be
// authored independently to catch a real drift.)
export const ALL_CLASSIFICATION_STATUS_COLUMNS = [
  ...PUBLIC_CLASSIFICATION_COLUMNS,
  ...ADMIN_ONLY_CLASSIFICATION_COLUMNS,
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
  driverName: string;
  hotstintMs: number;
};

// Public "Hot Stint Qualifying (seasonal)" leaderboard tab. Reads
// classification_status_public (a view, not classification_status directly)
// and is deliberately a separate query from getAdminClassificationHotStint,
// not the same query with columns hidden in the UI, which would still ship
// them in the network response. The view filters to eligible = true (has
// completed signup, has a linked account, AND has a hotstint time) — not
// just "hotstint_ms is not null" — so a driver who set a time without
// completing classification signup doesn't show ranked here and then vanish
// once divisions publish. See the view's migration for the full reasoning.
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
    first_name: string | null;
    last_name: string | null;
    hotstint_ms: number;
  }>).map((r, i) => ({
    position: i + 1,
    driverName: [r.first_name, r.last_name].filter(Boolean).join(' ') || 'Unknown',
    hotstintMs: r.hotstint_ms,
  }));
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
  }));
}
