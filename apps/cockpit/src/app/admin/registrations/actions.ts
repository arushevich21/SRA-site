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
// The ids these take are REGISTRATION ids — one entry (one car) in one event.
// Note that is deliberately NOT the same id the driver-facing CurrentTeam uses,
// which is a `teams.id`: a team is a persistent season roster that can outlive
// any single event's entry. Admin acts on the entry.
//
// Team-level actions take an ARRAY: on a car-per-driver championship (GT3
// Team Series, championships.shared_car = false — see 20260915) a team is
// one registrations row per driver, all sharing team_id, so "delete team" /
// "set class" mean every one of them. On a shared-car championship the
// array has one element.

/**
 * Delete an entire team's entry — every registrations row in it. Cascades to
 * registration_drivers via registration_drivers_registration_id_fkey ON
 * DELETE CASCADE, freeing every driver on it to register elsewhere (the
 * one-claim-per-event unique constraint is on registration_drivers, so the
 * claim goes with the row).
 *
 * The `teams` row is intentionally left behind — it is the season roster, not
 * this event's entry, and other championships in the same series+season may
 * still reference it.
 */
export async function deleteRegistration(registrationIds: string[]): Promise<void> {
  await requireAdmin();
  const ids = registrationIds.filter(Boolean);
  if (ids.length === 0) return;

  const { error } = await supabase
    .from('registrations')
    .delete()
    .in('id', ids);

  if (error) throw new Error(error.message);
  revalidatePath('/admin/registrations');
}

/**
 * Remove a single driver from an entry. Frees the driver to join or register
 * another entry for this championship.
 *
 * If that leaves the car with nobody in it — always, on a car-per-driver
 * championship; only for the last driver on a shared-car one — the
 * registrations row goes too, exactly as the driver-facing leaveTeam() does:
 * a driverless car would otherwise still occupy a max_registrations slot and
 * be pushed to the ACCSM grid with no one in it. A shared car with drivers
 * left persists under-filled.
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

  const { count, error: countError } = await supabase
    .from('registration_drivers')
    .select('driver_id', { count: 'exact', head: true })
    .eq('registration_id', registrationId);
  if (countError) throw new Error(countError.message);

  if ((count ?? 0) === 0) {
    const { error: deleteError } = await supabase
      .from('registrations')
      .delete()
      .eq('id', registrationId);
    if (deleteError) throw new Error(deleteError.message);
  }

  revalidatePath('/admin/registrations');
}

/**
 * Assign an endurance entry's class (Open / Silver / Bronze), or clear it
 * (null). Endurance championships group by this admin-set class instead of
 * Division 1–4. Applied to every car in the team so they stay together.
 */
export async function setEntryClass(
  registrationIds: string[],
  entryClass: string | null,
): Promise<void> {
  await requireAdmin();
  const ids = registrationIds.filter(Boolean);
  if (ids.length === 0) return;

  const { error } = await supabase
    .from('registrations')
    .update({ entry_class: entryClass })
    .in('id', ids);

  if (error) throw new Error(error.message);
  revalidatePath('/admin/registrations');
}
