'use server';

import { createSupabaseServerClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { isValidCountryCode } from '@/lib/countries';

const UNIQUE_VIOLATION = '23505';

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

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { error: 'That Steam ID is already linked to another driver.' };
    }
    return { error: 'Failed to save. Please try again.' };
  }

  revalidatePath('/profile');
  return { success: true };
}

export type ProfileDetailsState = { error?: string; success?: boolean } | null;

export async function updateProfileDetails(
  _prev: ProfileDetailsState,
  formData: FormData,
): Promise<ProfileDetailsState> {
  const firstName = (formData.get('first_name') as string ?? '').trim();
  const lastName = (formData.get('last_name') as string ?? '').trim();
  const shortName = (formData.get('short_name') as string ?? '').trim().toUpperCase();
  const country = (formData.get('country') as string ?? '').trim().toUpperCase();
  const driverNumberRaw = (formData.get('driver_number') as string ?? '').trim();

  if (!firstName) return { error: 'First name is required.' };
  if (!lastName) return { error: 'Last name is required.' };
  if (shortName.length !== 3) return { error: 'Short name must be exactly 3 characters.' };
  if (country && !isValidCountryCode(country)) return { error: 'Select a valid country.' };

  let driverNumber: number | null = null;
  if (driverNumberRaw) {
    driverNumber = Number(driverNumberRaw);
    if (!Number.isInteger(driverNumber) || driverNumber < 2 || driverNumber > 999) {
      return { error: 'Driver number must be between 2 and 999.' };
    }
  }

  const displayName = driverNumber !== null
    ? `${firstName} ${lastName} ┊${driverNumber}`
    : `${firstName} ${lastName}`;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'Not authenticated.' };

  const { error } = await supabase
    .from('drivers')
    .update({
      first_name: firstName,
      last_name: lastName,
      short_name: shortName,
      country: country || null,
      driver_number: driverNumber,
      display_name: displayName,
    })
    .eq('user_id', user.id);

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { error: 'That driver number is already taken.' };
    }
    return { error: 'Failed to save. Please try again.' };
  }

  revalidatePath('/profile');
  return { success: true };
}
