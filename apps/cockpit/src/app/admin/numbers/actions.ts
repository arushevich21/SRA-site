'use server';

import { requireAdmin } from '@/lib/require-admin';
import { supabase as adminClient } from '@/lib/supabase';
import { setNumbersLocked } from '@/lib/settings';
import { revalidatePath } from 'next/cache';

export async function setLock(locked: boolean): Promise<void> {
  await requireAdmin();
  await setNumbersLocked(locked);
  revalidatePath('/admin/numbers');
}

// Toggle a driver's number immunity from purging (preserve_driver_number).
export async function setPreserve(
  driverId: string,
  preserve: boolean,
): Promise<void> {
  await requireAdmin();
  const { error } = await adminClient
    .from('drivers')
    .update({ preserve_driver_number: preserve })
    .eq('id', driverId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/numbers');
}

// Null the driver_number for the given drivers, re-verifying exemptions
// server-side so a stale client can't purge a protected number.
export async function purgeNumbers(
  driverIds: string[],
): Promise<{ purged: number }> {
  await requireAdmin();
  if (driverIds.length === 0) return { purged: 0 };

  const { data: rows } = await adminClient
    .from('drivers')
    .select('id, is_admin, preserve_driver_number, is_champion, driver_number')
    .in('id', driverIds);

  const safe = (rows ?? [])
    .filter(
      (d) =>
        d.driver_number != null &&
        !d.is_champion &&
        !d.is_admin &&
        d.preserve_driver_number !== true,
    )
    .map((d) => d.id);

  if (safe.length === 0) return { purged: 0 };

  const { error } = await adminClient
    .from('drivers')
    .update({ driver_number: null })
    .in('id', safe);
  if (error) throw new Error(error.message);

  revalidatePath('/admin/numbers');
  return { purged: safe.length };
}
