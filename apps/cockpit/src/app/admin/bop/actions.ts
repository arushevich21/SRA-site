'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission, ADMIN_PERMISSIONS } from '@/lib/require-admin';
import { supabase } from '@/lib/supabase';
import { clampBallast, clampRestrictor } from '@/content/bop';

export type BopEntry = {
  track: string;
  carModel: number;
  ballastKg: number;
  restrictor: number;
};

export type SaveBopResult = { ok: true } | { ok: false; error: string };

/**
 * Replace the whole BoP grid. Only non-zero cells are stored (a 0/0 cell is a
 * no-op in ACC and is omitted from the export anyway), so we delete all rows
 * and re-insert the meaningful ones — the grid is small enough that this is
 * simpler and safer than diffing.
 */
export async function saveBop(entries: BopEntry[]): Promise<SaveBopResult> {
  await requirePermission(ADMIN_PERMISSIONS.BOP);

  const rows = entries
    .map((e) => ({
      track: e.track,
      car_model: e.carModel,
      ballast_kg: clampBallast(e.ballastKg),
      restrictor: clampRestrictor(e.restrictor),
    }))
    .filter((r) => r.ballast_kg !== 0 || r.restrictor !== 0);

  // Clear then insert. delete needs a WHERE, so match all car_model >= 0.
  const { error: delErr } = await supabase
    .from('bop_entries')
    .delete()
    .gte('car_model', 0);
  if (delErr) return { ok: false, error: delErr.message };

  if (rows.length > 0) {
    const { error: insErr } = await supabase.from('bop_entries').insert(rows);
    if (insErr) return { ok: false, error: insErr.message };
  }

  await supabase
    .from('bop_config')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', 'default');

  revalidatePath('/admin/bop');
  revalidatePath('/about/custom-bop');
  return { ok: true };
}

export type PushBopResult =
  | { ok: true; queued: boolean }
  | { ok: false; error: string };

/**
 * Publish the saved BoP to the live ACCSM managers.
 *
 * Cockpit cannot write the ACCSM store itself — it lives on a CIFS mount only
 * the bot host has. So this enqueues a `bop_push` job on the `bot_jobs` outbox
 * (migration 20260927) and SRA-Bot's consumer does the write, the same path the
 * entrylist sync takes. Pickup is immediate via Realtime, with a 30s poll as
 * the safety net.
 *
 * Deliberately separate from saveBop(): a BoP change alters every car on track,
 * so it publishes on an explicit click, never as a side effect of saving.
 *
 * `queued: false` means a push was already pending (the pending-dedup index) —
 * that is success, not failure. The consumer writes current DB state whenever
 * it runs, so one job covers both clicks.
 */
export async function pushBopToAccsm(): Promise<PushBopResult> {
  await requirePermission(ADMIN_PERMISSIONS.BOP);

  const { error } = await supabase
    .from('bot_jobs')
    .insert({ type: 'bop_push', payload: {} });

  if (error) {
    if (error.code === '23505') return { ok: true, queued: false };
    return { ok: false, error: error.message };
  }
  return { ok: true, queued: true };
}
