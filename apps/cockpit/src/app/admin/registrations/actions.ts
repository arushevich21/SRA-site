'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/require-admin';
import { supabase } from '@/lib/supabase';

/**
 * Delete an entire team registration. Cascades to team_members via the
 * ON DELETE CASCADE FK, freeing every driver to register elsewhere.
 */
export async function deleteTeam(teamId: string): Promise<void> {
  await requireAdmin();
  if (!teamId) return;

  const { error } = await supabase
    .from('team_registrations')
    .delete()
    .eq('id', teamId);

  if (error) throw new Error(error.message);
  revalidatePath('/admin/registrations');
}

/**
 * Remove a single driver from a team. The team persists under-filled — the same
 * shape the driver-facing "leave team" flow produces. Frees the driver to join
 * or register another team for this championship.
 */
export async function removeMember(
  teamId: string,
  driverId: string,
): Promise<void> {
  await requireAdmin();
  if (!teamId || !driverId) return;

  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('driver_id', driverId);

  if (error) throw new Error(error.message);
  revalidatePath('/admin/registrations');
}

/**
 * Assign an endurance team's class (Open / Silver / Bronze), or clear it (null).
 * Endurance championships group by this admin-set class instead of Division 1–4.
 */
export async function setEntryClass(
  teamId: string,
  entryClass: string | null,
): Promise<void> {
  await requireAdmin();
  if (!teamId) return;

  const { error } = await supabase
    .from('team_registrations')
    .update({ entry_class: entryClass })
    .eq('id', teamId);

  if (error) throw new Error(error.message);
  revalidatePath('/admin/registrations');
}
