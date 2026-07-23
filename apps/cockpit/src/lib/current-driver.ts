import 'server-only';
import { createSupabaseServerClient } from './supabase-server';

// Used by the leaderboard's "my laps" filter — hotlap rows are keyed by
// steam_id, not any auth user id, so this resolves the signed-in user's
// linked SteamID via their drivers row. Returns null when signed out or not
// yet linked (see profile/actions.ts's updateSteamId) — same pattern as
// require-admin.ts's is_admin lookup, never throws.
export async function getCurrentSteamId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from('drivers')
    .select('steam_id')
    .eq('user_id', user.id)
    .maybeSingle();

  return data?.steam_id ?? null;
}
