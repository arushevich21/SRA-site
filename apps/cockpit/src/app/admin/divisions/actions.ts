'use server';

import { requireAdmin } from '@/lib/require-admin';
import { supabase } from '@/lib/supabase';

export async function assignDivision(
  driverIds: string[],
  divisionId: number | null,
): Promise<void> {
  await requireAdmin();
  if (driverIds.length === 0) return;

  const { error } = await supabase
    .from('drivers')
    .update({ division_id: divisionId })
    .in('id', driverIds);

  if (error) throw new Error(error.message);
}

export async function assignTier(
  driverIds: string[],
  tier: 'gold' | 'silver' | null,
): Promise<void> {
  await requireAdmin();
  if (driverIds.length === 0) return;

  const { error } = await supabase
    .from('drivers')
    .update({ tier })
    .in('id', driverIds);

  if (error) throw new Error(error.message);
}

/**
 * Bulk assign division and/or tier to a set of drivers.
 * Pass `undefined` to leave a field unchanged, `null` to clear it.
 */
export async function assignBulk(
  driverIds: string[],
  divisionId: number | null | undefined,
  tier: 'gold' | 'silver' | null | undefined,
): Promise<void> {
  await requireAdmin();
  if (driverIds.length === 0) return;

  const patch: Record<string, unknown> = {};
  if (divisionId !== undefined) patch.division_id = divisionId;
  if (tier !== undefined) patch.tier = tier;
  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase
    .from('drivers')
    .update(patch)
    .in('id', driverIds);

  if (error) throw new Error(error.message);
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
