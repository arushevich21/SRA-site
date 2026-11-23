import 'server-only';
import { randomBytes } from 'node:crypto';
import { supabase } from '@/lib/supabase';
import { getS19Wrapped } from './s19-prototype';
import type { WrappedDriverCard } from './card';

// Season Wrapped snapshot: every driver's card computed once and stored
// (wrapped_cards), so the public pages never recompute from live tables.
// Tables are service-role only (20261124_wrapped.sql); this module is the
// only reader/writer, and decides what a request may see.

export const WRAPPED_SEASON = 'acc-gt3-s19';

export { WRAPPED_UNTIL, wrappedLive } from './card';

export type WrappedSummary = {
  drivers: number;
  races: number;
  laps: number;
  km: number;
  hours: number;
  sweatiest: { name: string; laps: number } | null;
};

const token = () => randomBytes(16).toString('base64url');

/** Build every S19 card from live data and upsert the snapshot. Admin-only caller. */
export async function generateSnapshot(): Promise<{ cards: number }> {
  const { roster } = await getS19Wrapped(null);
  const cards: WrappedDriverCard[] = [];
  for (const r of roster) {
    const { card } = await getS19Wrapped(r.steamId);
    if (card) cards.push(card);
  }

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

  const sweat = cards
    .map((c) => c.easterEggs.find((e) => e.kind === 'sweat'))
    .find((e): e is Extract<WrappedDriverCard['easterEggs'][number], { kind: 'sweat' }> => !!e);
  const sweatCard = cards.find((c) => c.easterEggs.some((e) => e.kind === 'sweat'));
  const summary: WrappedSummary = {
    drivers: cards.length,
    races: cards.reduce((n, c) => n + c.numbers.races, 0),
    laps: cards.reduce((n, c) => n + c.numbers.laps, 0),
    km: Math.round(cards.reduce((n, c) => n + c.numbers.km, 0)),
    hours: Math.round(cards.reduce((n, c) => n + c.numbers.hours, 0)),
    sweatiest: sweat && sweatCard ? { name: sweatCard.name, laps: sweat.laps } : null,
  };
  const { error: sErr } = await supabase
    .from('wrapped_seasons')
    .upsert({ season: WRAPPED_SEASON, summary, generated_at: now }, { onConflict: 'season' });
  if (sErr) throw new Error(sErr.message);

  return { cards: cards.length };
}

export async function getSnapshotStatus(): Promise<
  { cards: number; generatedAt: string | null } | { error: string }
> {
  const { count, error } = await supabase
    .from('wrapped_cards')
    .select('steam_id', { count: 'exact', head: true })
    .eq('season', WRAPPED_SEASON);
  if (error) return { error: error.message };
  const { data } = await supabase
    .from('wrapped_seasons')
    .select('generated_at')
    .eq('season', WRAPPED_SEASON)
    .maybeSingle();
  return { cards: count ?? 0, generatedAt: (data?.generated_at as string | undefined) ?? null };
}

export async function getSummary(): Promise<WrappedSummary | null> {
  const { data } = await supabase
    .from('wrapped_seasons')
    .select('summary')
    .eq('season', WRAPPED_SEASON)
    .maybeSingle();
  return (data?.summary as WrappedSummary | undefined) ?? null;
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
