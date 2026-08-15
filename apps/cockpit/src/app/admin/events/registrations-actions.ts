'use server';

import { requireAdmin } from '@/lib/require-admin';
import { supabase } from '@/lib/supabase';

// Promotion is an explicit admin override: deliberately does NOT re-check
// max_registrations (an admin choosing to promote past the cap is allowed —
// this is a manual decision, not another concurrent registration racing the
// cap) and deliberately does NOT renumber the remaining waitlist_position
// values, per spec: positions are assigned once, at waitlist time, and never
// reshuffled.
export async function promoteFromWaitlist(registrationId: string): Promise<void> {
  await requireAdmin();
  if (!registrationId) return;

  const { error } = await supabase
    .from('registrations')
    // Guard on status='waitlisted' so this can't no-op-overwrite an
    // already-confirmed row's state if called twice (e.g. a double click).
    .update({ status: 'confirmed', waitlist_position: null })
    .eq('id', registrationId)
    .eq('status', 'waitlisted');

  if (error) throw new Error(error.message);
}
