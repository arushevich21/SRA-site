'use server';

import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabase as adminClient } from '@/lib/supabase';
import { getNumbersLocked } from '@/lib/settings';
import { revalidatePath } from 'next/cache';
import { isValidCountryCode } from '@/lib/countries';
import { computeDriverDisplayName } from '@/lib/driver-display-name';
import { notifyDiscordProfileUpdated } from '@/lib/discord-notify';

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

  if (!driverNumberRaw) return { error: 'Driver number is required.' };
  const driverNumber = Number(driverNumberRaw);
  if (!Number.isInteger(driverNumber) || driverNumber < 2 || driverNumber > 999) {
    return { error: 'Driver number must be between 2 and 999.' };
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'Not authenticated.' };

  // Mid-season lock: while numbers are locked, non-admins cannot CHANGE their
  // driver_number (other profile fields stay editable). Admins are exempt.
  // First-time assignment (driver_number currently NULL — the profile-
  // completion gate in middleware.ts requires one) is never blocked by the
  // lock: it's completing registration, not swapping an already-raced-with
  // number mid-season, and the alternative is a genuine lockout — a
  // brand-new driver who could never satisfy the gate until the lock lifts.
  const { data: caller } = await adminClient
    .from('drivers')
    .select('is_admin, driver_number, is_champion, discord_id')
    .eq('user_id', user.id)
    .maybeSingle();

  const numberChanged = caller?.driver_number != null && driverNumber !== caller.driver_number;
  if (!caller?.is_admin && numberChanged && (await getNumbersLocked())) {
    return {
      error: 'Driver number changes are locked mid-season. Contact an admin.',
    };
  }

  // No champion-reservation guard needed: #1 isn't a stored number (it's the
  // is_champion badge), and the champion keeps their own number, protected by
  // the unique constraint like everyone else's.

  // The reigning D1 champion always displays #1 (see computeDriverDisplayName)
  // — driver_number below still stores their real permanent number.
  const displayName = computeDriverDisplayName({
    firstName,
    lastName,
    driverNumber,
    isChampion: caller?.is_champion ?? false,
    fallback: `${firstName} ${lastName}`,
  });

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

  // Name/number are exactly what the bot builds a Discord nickname from, so
  // poke it to resync now rather than leaving the nick stale until the member
  // happens to change something in the guild. Deliberately non-fatal: the row
  // is already saved and a Discord outage must not fail the save.
  await notifyDiscordProfileUpdated(caller?.discord_id);

  revalidatePath('/profile');
  return { success: true };
}

// ── Broadcast photo ──────────────────────────────────────────────────────
//
// The picture shown on stream (intermission / commentator lower-third).
// Distinct from avatar_url (Discord): this one the driver chooses for air.
// Service-role upload keyed by the driver's own uuid — the object path is
// derived server-side from the session, never from the form, so a user can
// only ever write their own file. See 20260916_driver_photos.sql.

export type PhotoState = { error?: string; success?: boolean } | null;

const PHOTO_BUCKET = 'driver-photos';
const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const PHOTO_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export async function uploadDriverPhoto(_prev: PhotoState, formData: FormData): Promise<PhotoState> {
  const file = formData.get('photo');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose an image first.' };
  const ext = PHOTO_TYPES[file.type];
  if (!ext) return { error: 'Use a PNG, JPG or WebP image.' };
  if (file.size > PHOTO_MAX_BYTES) return { error: 'Image must be under 2 MB.' };

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated.' };

  const { data: driver } = await adminClient
    .from('drivers')
    .select('id, photo_url')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!driver) return { error: 'No driver profile found for this account.' };

  // A changed extension would otherwise leave the old object behind.
  await removeStoredPhoto(driver.photo_url);

  const path = `${driver.id}.${ext}`;
  const { error: uploadError } = await adminClient.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

  // Cache-bust: the path is stable across re-uploads, and OBS/browsers would
  // otherwise keep showing the previous picture until their cache expired.
  const { data } = adminClient.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  const photoUrl = `${data.publicUrl}?v=${Date.now()}`;

  const { error } = await adminClient.from('drivers').update({ photo_url: photoUrl }).eq('id', driver.id);
  if (error) return { error: 'Failed to save. Please try again.' };

  revalidatePath('/profile');
  return { success: true };
}

export async function removeDriverPhoto(): Promise<PhotoState> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated.' };

  const { data: driver } = await adminClient
    .from('drivers')
    .select('id, photo_url')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!driver) return { error: 'No driver profile found for this account.' };

  await removeStoredPhoto(driver.photo_url);
  const { error } = await adminClient.from('drivers').update({ photo_url: null }).eq('id', driver.id);
  if (error) return { error: 'Failed to remove. Please try again.' };

  revalidatePath('/profile');
  return { success: true };
}

// Deletes the object a stored photo_url points at. Best-effort: a missing
// object is fine, and a storage hiccup must not block the row update.
async function removeStoredPhoto(photoUrl: string | null): Promise<void> {
  if (!photoUrl) return;
  const marker = `/${PHOTO_BUCKET}/`;
  const index = photoUrl.indexOf(marker);
  if (index === -1) return;
  const path = photoUrl.slice(index + marker.length).split('?')[0];
  if (!path) return;
  const { error } = await adminClient.storage.from(PHOTO_BUCKET).remove([path]);
  if (error) console.error('driver photo remove failed (continuing):', error.message);
}
