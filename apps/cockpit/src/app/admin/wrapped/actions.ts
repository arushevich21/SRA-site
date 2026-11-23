'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/require-admin';
import { generateSnapshot } from '@/lib/wrapped/snapshot';

export type SnapshotResult = { ok: true; cards: number } | { ok: false; error: string } | null;

// Builds every driver's Season 19 Wrapped card from live data and stores it.
// Safe to re-run: share tokens are kept, so posted links keep working.
export async function generateWrappedSnapshot(): Promise<SnapshotResult> {
  await requireAdmin();
  try {
    const { cards } = await generateSnapshot();
    revalidatePath('/admin/wrapped');
    return { ok: true, cards };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
