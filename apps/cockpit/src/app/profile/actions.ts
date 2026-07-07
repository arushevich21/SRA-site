'use server';

import { createSupabaseServerClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

export type SteamLinkState = { error?: string; success?: boolean } | null;

export async function updateSteamId(
  _prev: SteamLinkState,
  formData: FormData,
): Promise<SteamLinkState> {
  const steamId = (formData.get('steam_id') as string ?? '').trim();

  if (!/^\d{17}$/.test(steamId)) {
    return { error: 'Steam ID must be exactly 17 digits (Steam64 format).' };
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'Not authenticated.' };

  const { error } = await supabase
    .from('drivers')
    .update({ steam_id: steamId })
    .eq('user_id', user.id);

  if (error) return { error: 'Failed to save. Please try again.' };

  revalidatePath('/profile');
  return { success: true };
}
