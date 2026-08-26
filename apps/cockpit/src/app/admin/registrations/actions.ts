'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/require-admin';
import { supabase } from '@/lib/supabase';

// These act on `registrations` / `registration_drivers`, NOT the legacy
// `team_registrations` / `team_members` pair they used to target. Nothing has
// written the legacy tables since 20260814d-f moved registration onto
// register_entry(); they hold zero rows, so every action here was a silent
// no-op (a DELETE matching nothing still succeeds) and the page above them
// listed nothing at all.
//
// The id these take is a REGISTRATION id — one entry (one car) in one event.
// Note that is deliberately NOT the same id the driver-facing CurrentTeam uses,
// which is a `teams.id`: a team is a persistent season roster that can outlive
// any single event's entry. Admin acts on the entry.

/**
 * Delete an entire entry. Cascades to registration_drivers via
 * registration_drivers_registration_id_fkey ON DELETE CASCADE, freeing every
 * driver on it to register elsewhere (the one-claim-per-event unique constraint
 * is on registration_drivers, so the claim goes with the row).
 *
 * The `teams` row is intentionally left behind — it is the season roster, not
 * this event's entry, and other championships in the same series+season may
 * still reference it.
 */
export async function deleteRegistration(registrationId: string): Promise<void> {
  await requireAdmin();
  if (!registrationId) return;

  const { error } = await supabase
    .from('registrations')
    .delete()
    .eq('id', registrationId);

  if (error) throw new Error(error.message);
  revalidatePath('/admin/registrations');
}

/**
 * Remove a single driver from an entry. The entry persists under-filled — the
 * same shape the driver-facing "leave team" flow produces. Frees the driver to
 * join or register another entry for this championship.
 */
export async function removeMember(
  registrationId: string,
  driverId: string,
): Promise<void> {
  await requireAdmin();
  if (!registrationId || !driverId) return;

  const { error } = await supabase
    .from('registration_drivers')
    .delete()
    .eq('registration_id', registrationId)
    .eq('driver_id', driverId);

  if (error) throw new Error(error.message);
  revalidatePath('/admin/registrations');
}

/**
 * Assign an endurance entry's class (Open / Silver / Bronze), or clear it
 * (null). Endurance championships group by this admin-set class instead of
 * Division 1–4.
 */
export async function setEntryClass(
  registrationId: string,
  entryClass: string | null,
): Promise<void> {
  await requireAdmin();
  if (!registrationId) return;

  const { error } = await supabase
    .from('registrations')
    .update({ entry_class: entryClass })
    .eq('id', registrationId);

  if (error) throw new Error(error.message);
  revalidatePath('/admin/registrations');
}
