import 'server-only';
import { supabase } from '@/lib/supabase';
import { ENGINE, ALIEN_CUTOFF_RANK } from './srating';

export type SralienSyncResult = {
  promoted: string[]; // driver ids newly flagged is_sralien
  demoted: string[]; // driver ids un-flagged
};

// drivers.is_sralien is the badge shown everywhere BUT the SRAting leaderboard
// itself (registration, standings, results tabs — see driver-tier-badge.ts) —
// the leaderboard page computes "top 10" live off driver_ratings and never
// reads this column (see getSRatingData's own comment). This is what keeps
// the flag in sync with that same top 10, so the badge means the same thing
// everywhere. driver_ratings is refreshed by an external pipeline on its own
// weekly cadence — call this right after (see the refresh-srating cron),
// not on a schedule of its own.
export async function syncSralienStatus(): Promise<SralienSyncResult> {
  const { data, error } = await supabase
    .from('driver_ratings')
    .select('drivers!inner(id)')
    .eq('engine', ENGINE)
    .order('composite', { ascending: false, nullsFirst: false })
    .limit(ALIEN_CUTOFF_RANK);
  if (error) throw error;

  const topTenIds = (data as unknown as { drivers: { id: string } }[]).map((r) => r.drivers.id);

  const { data: currentlyFlagged, error: flaggedErr } = await supabase
    .from('drivers')
    .select('id')
    .eq('is_sralien', true);
  if (flaggedErr) throw flaggedErr;

  const topTenSet = new Set(topTenIds);
  const demoted = (currentlyFlagged ?? [])
    .map((d) => d.id as string)
    .filter((id) => !topTenSet.has(id));
  const promoted = topTenIds.filter(
    (id) => !(currentlyFlagged ?? []).some((d) => d.id === id),
  );

  if (demoted.length > 0) {
    const { error: demoteErr } = await supabase
      .from('drivers')
      .update({ is_sralien: false })
      .in('id', demoted);
    if (demoteErr) throw demoteErr;
  }
  if (promoted.length > 0) {
    const { error: promoteErr } = await supabase
      .from('drivers')
      .update({ is_sralien: true })
      .in('id', promoted);
    if (promoteErr) throw promoteErr;
  }

  return { promoted, demoted };
}
