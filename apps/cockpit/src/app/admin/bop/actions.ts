'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/require-admin';
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
  await requireAdmin();

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
  return { ok: true };
}
