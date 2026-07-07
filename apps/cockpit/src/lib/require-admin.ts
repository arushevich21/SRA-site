import 'server-only';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from './supabase-server';

/**
 * Guard for admin-only pages and server actions.
 *
 * Reads the caller's own driver row via the anon+session client (covered by
 * drivers_select_own RLS). If the user is not authenticated or is_admin is
 * false, redirects immediately — never returns in those cases.
 *
 * After this returns, perform admin reads/writes via the service-role client
 * (lib/supabase.ts), which bypasses RLS for cross-driver operations.
 */
export async function requireAdmin(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const { data } = await supabase
    .from('drivers')
    .select('is_admin')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data?.is_admin) redirect('/');
}
