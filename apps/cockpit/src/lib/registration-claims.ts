import 'server-only';
import type { ChampionshipContent } from '@/content/championships';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabase as adminClient } from '@/lib/supabase';

export { isWithdrawWindow } from '@/lib/championship-status';

// The first of `candidates` the signed-in driver holds a claim in — confirmed
// OR waitlisted (registration_drivers carries both). undefined when signed
// out, when there's no driver record, or when they're in none of them.
export async function findChampionshipWithMyClaim(
  candidates: ChampionshipContent[],
): Promise<ChampionshipContent | undefined> {
  const keyed = candidates.filter((c) => c.registrationKey && c.registrationSeason);
  if (keyed.length === 0) return undefined;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return undefined;

  const { data: driver } = await adminClient
    .from('drivers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!driver) return undefined;

  const { data: claims } = await adminClient
    .from('registration_drivers')
    .select('championship_key, season')
    .eq('driver_id', driver.id)
    .in(
      'championship_key',
      keyed.map((c) => c.registrationKey!),
    );
  const claimed = new Set((claims ?? []).map((c) => `${c.championship_key}|${c.season}`));
  return keyed.find((c) => claimed.has(`${c.registrationKey}|${c.registrationSeason}`));
}
