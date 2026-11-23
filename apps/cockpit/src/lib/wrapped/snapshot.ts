import 'server-only';
import { randomBytes } from 'node:crypto';
import { supabase } from '@/lib/supabase';
import { getS19Wrapped } from './s19-prototype';
import type { LeagueWrapped, WrappedDriverCard } from './card';
import { buildLeague } from './league';

// Season Wrapped snapshot: every driver's card computed once and stored
// (wrapped_cards), so the public pages never recompute from live tables.
// Tables are service-role only (20261124_wrapped.sql); this module is the
// only reader/writer, and decides what a request may see.

export const WRAPPED_SEASON = 'acc-gt3-s19';

export { WRAPPED_UNTIL, wrappedLive } from './card';

const token = () => randomBytes(16).toString('base64url');

async function allCards(): Promise<WrappedDriverCard[]> {
  const { roster } = await getS19Wrapped(null);
  const cards: WrappedDriverCard[] = [];
  for (const r of roster) {
    const { card } = await getS19Wrapped(r.steamId);
    if (card) cards.push(card);
  }
  return cards;
}

/** The league story built live (admin preview before/without a snapshot). */
export async function buildLeagueLive(): Promise<LeagueWrapped> {
  return buildLeague(WRAPPED_SEASON, await allCards());
}

/** Build every S19 card from live data and upsert the snapshot. Admin-only caller. */
export async function generateSnapshot(): Promise<{ cards: number }> {
  const cards = await allCards();

  // Keep existing share tokens: regenerating must not break links people
  // have already posted.
  const { data: existing, error: exErr } = await supabase
    .from('wrapped_cards')
    .select('steam_id, share_token')
    .eq('season', WRAPPED_SEASON);
  if (exErr) throw new Error(exErr.message);
  const tokens = new Map(
    (existing ?? []).map((e) => [e.steam_id as string, e.share_token as string])
  );

  const now = new Date().toISOString();
  const rows = cards.map((c) => ({
    season: WRAPPED_SEASON,
    steam_id: c.steamId,
    driver_id: c.driverId,
    share_token: tokens.get(c.steamId) ?? token(),
    card: c,
    updated_at: now,
  }));
  for (let i = 0; i < rows.length; i += 50) {
    const { error } = await supabase
      .from('wrapped_cards')
      .upsert(rows.slice(i, i + 50), { onConflict: 'season,steam_id' });
    if (error) throw new Error(error.message);
  }

  const summary = await buildLeague(WRAPPED_SEASON, cards);
  const { error: sErr } = await supabase
    .from('wrapped_seasons')
    .upsert({ season: WRAPPED_SEASON, summary, generated_at: now }, { onConflict: 'season' });
  if (sErr) throw new Error(sErr.message);

  return { cards: cards.length };
}

export async function getSnapshotStatus(): Promise<
  { cards: number; generatedAt: string | null } | { error: string }
> {
  // A real GET, not `head: true`: a HEAD request has no body, so a missing
  // table came back as error-free with a null count and read as "no snapshot
  // yet" when the migration hadn't been run at all.
  const { count, error } = await supabase
    .from('wrapped_cards')
    .select('steam_id', { count: 'exact' })
    .eq('season', WRAPPED_SEASON)
    .limit(1);
  if (error) return { error: error.message || error.code || 'unknown error' };
  if (count == null) return { error: 'wrapped_cards could not be read' };
  const { data } = await supabase
    .from('wrapped_seasons')
    .select('generated_at')
    .eq('season', WRAPPED_SEASON)
    .maybeSingle();
  return { cards: count ?? 0, generatedAt: (data?.generated_at as string | undefined) ?? null };
}

export async function getSummary(): Promise<LeagueWrapped | null> {
  const { data } = await supabase
    .from('wrapped_seasons')
    .select('summary')
    .eq('season', WRAPPED_SEASON)
    .maybeSingle();
  return (data?.summary as LeagueWrapped | undefined) ?? null;
}

/** A driver's own card. Callers pass the SteamID from the signed-in session only. */
export async function getCardForSteam(
  steamId: string
): Promise<{ card: WrappedDriverCard; token: string } | null> {
  const { data } = await supabase
    .from('wrapped_cards')
    .select('card, share_token')
    .eq('season', WRAPPED_SEASON)
    .eq('steam_id', steamId)
    .maybeSingle();
  return data ? { card: data.card as WrappedDriverCard, token: data.share_token as string } : null;
}

/** Public by link: whoever holds the token sees the card. */
export async function getCardByToken(shareToken: string): Promise<WrappedDriverCard | null> {
  if (!/^[A-Za-z0-9_-]{16,32}$/.test(shareToken)) return null;
  const { data } = await supabase
    .from('wrapped_cards')
    .select('card')
    .eq('season', WRAPPED_SEASON)
    .eq('share_token', shareToken)
    .maybeSingle();
  return (data?.card as WrappedDriverCard | undefined) ?? null;
}

export async function hasSeen(driverId: string): Promise<boolean> {
  const { data } = await supabase
    .from('wrapped_views')
    .select('driver_id')
    .eq('driver_id', driverId)
    .eq('season', WRAPPED_SEASON)
    .maybeSingle();
  return !!data;
}

export async function markSeen(driverId: string): Promise<void> {
  await supabase
    .from('wrapped_views')
    .upsert(
      { driver_id: driverId, season: WRAPPED_SEASON },
      { onConflict: 'driver_id,season', ignoreDuplicates: true }
    );
}
