import 'server-only';
import { supabase as adminClient } from './supabase';

// Generic key/value settings, backed by the `settings` table.
// First consumer: the mid-season driver-number lock.

const NUMBERS_LOCKED = 'numbers_locked';

export async function getNumbersLocked(): Promise<boolean> {
  const { data } = await adminClient
    .from('settings')
    .select('value')
    .eq('key', NUMBERS_LOCKED)
    .maybeSingle();
  return data?.value === 'true';
}

export async function setNumbersLocked(locked: boolean): Promise<void> {
  const { error } = await adminClient
    .from('settings')
    .upsert(
      { key: NUMBERS_LOCKED, value: locked ? 'true' : 'false' },
      { onConflict: 'key' },
    );
  if (error) throw new Error(error.message);
}
