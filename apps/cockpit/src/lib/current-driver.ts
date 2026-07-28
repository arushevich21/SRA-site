import 'server-only';
import { createSupabaseServerClient } from './supabase-server';

export type CurrentDriverContext = {
  steamId: string | null;
  division: number | null; // 1-4, from drivers.division_id — null if unassigned
};

const SIGNED_OUT: CurrentDriverContext = { steamId: null, division: null };

// Used by the leaderboards' "my laps" / "my division" filters and the
// signed-in row highlight — hotlap rows are keyed by steam_id, not any auth
// user id, so this resolves the signed-in user's linked SteamID (and their
// registered division, for the "My Division" filter) via their drivers row
// in one query. Returns nulls when signed out or not yet linked (see
// profile/actions.ts's updateSteamId) — same pattern as require-admin.ts's
// is_admin lookup, never throws.
export async function getCurrentDriverContext(): Promise<CurrentDriverContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return SIGNED_OUT;

  const { data } = await supabase
    .from('drivers')
    .select('steam_id, division_id')
    .eq('user_id', user.id)
    .maybeSingle();

  return {
    steamId: data?.steam_id ?? null,
    division: data?.division_id ?? null,
  };
}
