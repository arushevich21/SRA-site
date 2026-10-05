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

// admin_add_team_driver()'s RAISE codes (20261005) → what the admin sees.
const ADD_DRIVER_ERRORS: Record<string, string> = {
  REGISTRATION_NOT_FOUND: 'That team no longer exists — reload the page.',
  CHAMPIONSHIP_KEY_INVALID: 'This entry points at a championship that no longer exists.',
  DRIVER_NOT_FOUND: 'That driver no longer exists — reload the page.',
  TEAM_FULL: 'That team is already full.',
  DIVISION_UNASSIGNED: 'That driver has no division yet — assign one first.',
  DIVISION_MISMATCH: 'That driver is in a different division from the team.',
  DRIVER_ALREADY_CLAIMED: 'That driver is already on an entry for this event.',
};

/**
 * Add a driver to an existing team that has a spot open.
 *
 * All the rules live in admin_add_team_driver() (see
 * supabase/migrations/20261005_admin_add_team_driver.sql), under the same
 * per-event lock as register_entry(): team size, same division on
 * division-grouped championships, and one entry per driver per event. On a
 * car-per-driver championship it adds a car for the new driver; on a
 * shared-car one it seats them in the team's car. The grid cap
 * (max_registrations) is deliberately not applied — an admin completing a
 * team is an override.
 *
 * `registrationId` is any car of the team — the function finds the rest by
 * team_id. Returns the reason on failure (see ADD_DRIVER_ERRORS).
 */
export async function addTeamDriver(
  registrationId: string,
  driverId: string,
): Promise<{ error: string | null }> {
  await requireAdmin();
  if (!registrationId || !driverId) return { error: 'Pick a driver first.' };

  const { error } = await supabase.rpc('admin_add_team_driver', {
    p_registration_id: registrationId,
    p_driver_id: driverId,
  });

  if (error) {
    // Returned, not thrown: Next.js replaces a thrown server-action error's
    // message with a generic one in production builds.
    const code = error.message.split(':')[0]?.trim();
    return { error: ADD_DRIVER_ERRORS[code] ?? error.message };
  }
  revalidatePath('/admin/registrations');
  return { error: null };
}

// admin_merge_into_team()'s own RAISE codes (20261005b); the rest come from
// the admin_add_team_driver() calls it makes for each moved driver.
const MERGE_ERRORS: Record<string, string> = {
  ...ADD_DRIVER_ERRORS,
  TEAM_FULL: 'Not enough open spots on the team for every driver on that entry.',
  DIVISION_MISMATCH: 'A driver on that entry is in a different division from the team.',
  MERGE_DIFFERENT_EVENT: 'Those entries are in different championships.',
  MERGE_SAME_TEAM: 'That entry is already part of this team.',
  MERGE_SOURCE_EMPTY: 'That entry has no drivers to move.',
};

/**
 * Merge another entry into a team: for two drivers who each registered solo
 * but share a car. The source entry (its whole team) is deleted and each of
 * its drivers is added to the target team exactly as addTeamDriver() would —
 * they take the target's car, division, class and status. Atomic: a failure
 * leaves both entries as they were. See
 * supabase/migrations/20261005b_admin_merge_into_team.sql.
 *
 * Both ids are any car of their team.
 */
export async function mergeIntoTeam(
  targetRegistrationId: string,
  sourceRegistrationId: string,
): Promise<{ error: string | null }> {
  await requireAdmin();
  if (!targetRegistrationId || !sourceRegistrationId) return { error: 'Pick an entry first.' };

  const { error } = await supabase.rpc('admin_merge_into_team', {
    p_target_registration_id: targetRegistrationId,
    p_source_registration_id: sourceRegistrationId,
  });

  if (error) {
    const code = error.message.split(':')[0]?.trim();
    return { error: MERGE_ERRORS[code] ?? error.message };
  }
  revalidatePath('/admin/registrations');
  return { error: null };
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
