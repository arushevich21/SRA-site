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

// Section-scoped admin access (2026-08-25) — a permission-list system
// alongside is_admin, not a second boolean, so a third scoped role next
// month is a one-line addition here rather than another column.
// admin_permissions + has_admin_permission() are defined in
// 20260825c_admin_permissions.sql; that migration's SQL literal ('bop')
// MUST match this constant's value exactly — see
// require-admin.test.ts, which asserts they agree by reading the migration
// file's text, the same pattern hot-stint-store.test.ts uses for its
// column-list assertions.
export const ADMIN_PERMISSIONS = {
  BOP: 'bop',
} as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[keyof typeof ADMIN_PERMISSIONS];

/**
 * Guard for a single scoped admin section (e.g. Manage BoP). Full admins
 * (is_admin) pass every permission check automatically — this is what lets
 * the other 20+ requireAdmin() call sites stay untouched; only the section
 * actually being scoped switches from requireAdmin() to this.
 *
 * Calls the has_admin_permission() RPC rather than selecting
 * admin_permissions directly — that table has no SELECT policy at all (see
 * its migration), so a direct select would silently return nothing even
 * for a real admin. The RPC (security definer) is the only access path, by
 * design.
 */
export async function requirePermission(permission: AdminPermission): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const { data, error } = await supabase.rpc('has_admin_permission', { perm: permission });
  if (error) {
    console.error('has_admin_permission RPC failed:', error);
    redirect('/');
  }
  if (!data) redirect('/');
}

export type AdminAccess = {
  isAdmin: boolean;
  permissions: ReadonlySet<AdminPermission>;
};

/**
 * Full admin status + every scoped permission the caller holds, for pages
 * (currently just /admin) that need to show a DIFFERENT view per access
 * level rather than a binary allow/deny — e.g. filtering which admin
 * sections appear. Redirects like requireAdmin()/requirePermission() if the
 * caller has neither is_admin nor any permission; otherwise returns and
 * lets the caller decide what to render.
 *
 * Checks each known permission individually (just BOP today) rather than a
 * "list my permissions" RPC: adding a second permission is already a
 * one-line addition to ADMIN_PERMISSIONS above AND a one-line addition to
 * admin/page.tsx's ADMIN_SECTIONS (which tool needs it) — a list-returning
 * RPC wouldn't remove that second edit, so it isn't saving a migration,
 * just moving the same one-line diff from here to a SQL function.
 */
export async function getAdminAccess(): Promise<AdminAccess> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const [{ data: driver }, { data: hasBop }] = await Promise.all([
    supabase.from('drivers').select('is_admin').eq('user_id', user.id).maybeSingle(),
    supabase.rpc('has_admin_permission', { perm: ADMIN_PERMISSIONS.BOP }),
  ]);

  const isAdmin = driver?.is_admin ?? false;
  const permissions = new Set<AdminPermission>();
  if (hasBop) permissions.add(ADMIN_PERMISSIONS.BOP);

  if (!isAdmin && permissions.size === 0) redirect('/');

  return { isAdmin, permissions };
}
