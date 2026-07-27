'use server';

import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabase as adminClient } from '@/lib/supabase';
import { getNumbersLocked } from '@/lib/settings';
import { revalidatePath } from 'next/cache';
import { isValidCountryCode } from '@/lib/countries';

const UNIQUE_VIOLATION = '23505';

export type SteamLinkState = { error?: string; success?: boolean } | null;

// Admin-only manual override. Regular users prove Steam ownership via the
// verified OpenID flow (see app/auth/steam/*) — they can no longer type a raw
// SteamID. This exists for edge cases (seeding fixes, locked-out accounts).
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

  // Gate: only admins may set a SteamID manually.
  const { data: caller } = await supabase
    .from('drivers')
    .select('is_admin')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!caller?.is_admin) return { error: 'Admins only.' };

  // Service-role write: manual override counts as verified (an admin vouches),
  // which also satisfies the Steam gate for that account.
  const { error } = await adminClient
    .from('drivers')
    .update({ steam_id: steamId, steam_verified: true })
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

  // Mid-season lock: while numbers are locked, non-admins cannot CHANGE their
  // driver_number (other profile fields stay editable). Admins are exempt.
  const { data: caller } = await adminClient
    .from('drivers')
    .select('is_admin, driver_number')
    .eq('user_id', user.id)
    .maybeSingle();

  const numberChanged = driverNumber !== (caller?.driver_number ?? null);
  if (!caller?.is_admin && numberChanged && (await getNumbersLocked())) {
    return {
      error: 'Driver number changes are locked mid-season. Contact an admin.',
    };
  }

  // Champion reservation: a number held for another driver's return from #1
  // (drivers.prior_driver_number) is reserved. The DB unique constraint only
  // covers the active driver_number, so guard the held numbers in code.
  if (driverNumber !== null) {
    const { data: held } = await adminClient
      .from('drivers')
      .select('user_id')
      .eq('prior_driver_number', driverNumber)
      .neq('user_id', user.id)
      .maybeSingle();
    if (held) {
      return { error: `#${driverNumber} is reserved for a returning champion.` };
    }
  }

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
