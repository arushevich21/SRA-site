import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase-server';

// The signed-in driver, from the session — the only identity Wrapped trusts
// for "your own card". Null when signed out or without a drivers row.
export async function getWrappedViewer(): Promise<{ driverId: string; steamId: string | null } | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('drivers').select('id, steam_id').eq('user_id', user.id).maybeSingle();
  return data ? { driverId: data.id as string, steamId: (data.steam_id as string | null) ?? null } : null;
}
