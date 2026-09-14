'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/require-admin';
import { supabase } from '@/lib/supabase';
import {
  notifyDiscordProfileUpdatedMany,
  type DiscordNudgeOutcome,
} from '@/lib/discord-notify';

// drivers.division_id/drivers.tier feed the tier badge (getDriverTierBadge,
// lib/driver-tier-badge.ts) wherever a driver's registered classification is
// shown. Exactly two page-level caches actually read that data and need
// busting after a write here — enumerated explicitly rather than blowing the
// whole site cache, since this runs repeatedly during classification:
//   - /acc/srating — no `revalidate`/`dynamic` export, so it's cached
//     indefinitely between explicit busts (same as /api/cron/refresh-srating
//     already does for its own reason). SRAting is GT3-only, hence the
//     hardcoded /acc/ prefix rather than a dynamic [sim] path.
//   - /[sim]/championships/[slug]/leaderboards — `revalidate = 3600` ISR.
//     sim/slug aren't derivable from a driver id here, so this uses Next's
//     dynamic-route revalidation form (path template + 'page' type) to bust
//     every sim/slug combination in one call instead of enumerating them.
//
// Deliberately does NOT reach the ACC hot-lap/hot-stint leaderboard pages
// ([sim]/leaderboards/[track] and friends). Those routes are all
// `force-dynamic`, so revalidatePath is a no-op for them — but the driver
// info baked into their rows comes from getAccTrackLeaderboard/
// getAccTrackHotStint (lib/acc/tracks.ts, lib/acc/hotstint.ts), each wrapped
// in unstable_cache with `revalidate: 300` and a *per-track* tag
// (`acc-hotlap:<track>` / `acc-hotstint:<track>`). unstable_cache's
// `revalidate` is time-based and self-correcting — once 300s elapses, the
// next request to that track's board simply refetches, no revalidateTag
// required. So a badge changed here is wrong for at most 5 minutes on those
// two pages and then fixes itself; deliberately not building per-driver
// track lookups + per-track revalidateTag calls to shrink a five-minute
// window that already self-heals (hotstint.ts ships with zero busting at all
// today for the same reason).
function revalidateDriverTierBadgePages(): void {
  revalidatePath('/acc/srating');
  revalidatePath('/[sim]/championships/[slug]/leaderboards', 'page');
}

export type AssignResult = {
  updated: number;
  discord: DiscordNudgeOutcome;
};

// Pushes a division/tier change back out to Discord.
//
// drivers.division_id and drivers.tier are what the bot's member_role_sync
// reads to decide a member's division ROLE — but the bot only ever runs that
// sync from its on_member_update listener; it does not poll. So a write here
// that isn't followed by a nudge leaves the driver graded on the site with no
// matching Discord role, indefinitely.
//
// This is the same loop /profile already closes on a self-service profile save
// (see app/profile/actions.ts). It was simply never wired to the admin grading
// path, which is where divisions are actually assigned.
//
// Looks discord_id up from the ids just written rather than taking it from the
// caller: the client sends driver row ids, and a stale client-side discord_id
// would nudge the wrong member.
async function nudgeDiscordFor(driverIds: string[]): Promise<DiscordNudgeOutcome> {
  const { data, error } = await supabase
    .from('drivers')
    .select('discord_id')
    .in('id', driverIds);

  // A failed lookup must not fail the grading write, which has already
  // committed — report it as "nothing nudged" and let the admin resync.
  if (error) {
    console.error('[divisions] discord_id lookup failed, skipping nudge:', error.message);
    return { kind: 'none' };
  }

  return notifyDiscordProfileUpdatedMany((data ?? []).map((d) => d.discord_id as string | null));
}

export async function assignDivision(
  driverIds: string[],
  divisionId: number | null,
): Promise<AssignResult> {
  await requireAdmin();
  if (driverIds.length === 0) return { updated: 0, discord: { kind: 'none' } };

  const { error } = await supabase
    .from('drivers')
    .update({ division_id: divisionId })
    .in('id', driverIds);

  if (error) throw new Error(error.message);
  revalidateDriverTierBadgePages();
  return { updated: driverIds.length, discord: await nudgeDiscordFor(driverIds) };
}

export async function assignTier(
  driverIds: string[],
  tier: 'gold' | 'silver' | null,
): Promise<AssignResult> {
  await requireAdmin();
  if (driverIds.length === 0) return { updated: 0, discord: { kind: 'none' } };

  const { error } = await supabase
    .from('drivers')
    .update({ tier })
    .in('id', driverIds);

  if (error) throw new Error(error.message);
  revalidateDriverTierBadgePages();
  return { updated: driverIds.length, discord: await nudgeDiscordFor(driverIds) };
}

/**
 * Bulk assign division and/or tier to a set of drivers.
 * Pass `undefined` to leave a field unchanged, `null` to clear it.
 */
export async function assignBulk(
  driverIds: string[],
  divisionId: number | null | undefined,
  tier: 'gold' | 'silver' | null | undefined,
): Promise<AssignResult> {
  await requireAdmin();
  if (driverIds.length === 0) return { updated: 0, discord: { kind: 'none' } };

  const patch: Record<string, unknown> = {};
  if (divisionId !== undefined) patch.division_id = divisionId;
  if (tier !== undefined) patch.tier = tier;
  if (Object.keys(patch).length === 0) return { updated: 0, discord: { kind: 'none' } };

  const { error } = await supabase
    .from('drivers')
    .update(patch)
    .in('id', driverIds);

  if (error) throw new Error(error.message);
  revalidateDriverTierBadgePages();
  // A grading run over the whole cohort exceeds DISCORD_NUDGE_LIMIT and comes
  // back 'deferred-to-bulk' — the UI then tells the admin to run SRA-Bot's
  // bulk resync, which is far quicker than hundreds of throttled webhooks.
  return { updated: driverIds.length, discord: await nudgeDiscordFor(driverIds) };
}

export type ResolveDiscordIdsResult = {
  matchedIds: string[];
  notFound: string[];
};

/**
 * Resolves a pasted list of Discord IDs to driver row IDs, for bulk division
 * assignment before the initial classification runthrough.
 */
export async function resolveDiscordIds(discordIds: string[]): Promise<ResolveDiscordIdsResult> {
  await requireAdmin();
  const cleaned = [...new Set(discordIds.map((id) => id.trim()).filter(Boolean))];
  if (cleaned.length === 0) return { matchedIds: [], notFound: [] };

  const { data, error } = await supabase
    .from('drivers')
    .select('id, discord_id')
    .in('discord_id', cleaned);

  if (error) throw new Error(error.message);

  const found = new Set((data ?? []).map((d) => d.discord_id as string));
  return {
    matchedIds: (data ?? []).map((d) => d.id as string),
    notFound: cleaned.filter((id) => !found.has(id)),
  };
}
