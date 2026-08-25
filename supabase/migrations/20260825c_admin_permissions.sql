-- Task D (scoped BoP-manager role): adds a permission-list system alongside
-- drivers.is_admin, rather than a second boolean. Existing full admins are
-- unaffected — every check below is "is_admin OR has this specific
-- permission", so is_admin continues to satisfy everything it already did.
-- Only the follow-up code change (requirePermission(), admin/bop's two
-- files, admin/page.tsx's section filter) actually grants anyone new access
-- — this migration alone grants nothing.
--
-- ── admin_permissions ────────────────────────────────────────────────────
--
-- user_id references auth.users(id), same identity space drivers.user_id
-- already uses (drivers_user_id_fkey references auth.users(id) too) —
-- confirmed before writing this, not assumed.
--
-- permission is free text, not an enum: CLAUDE.md already flagged "a third
-- scoped role will appear within a month" — a migration-free permission
-- string lets the next one show up as a one-line TS change. The literal
-- value used here, 'bop', MUST match a single exported TS constant (to be
-- added in the follow-up code change, e.g. ADMIN_PERMISSIONS.BOP in
-- lib/require-admin.ts) — a typo on either side fails silently in opposite
-- directions (TS side: permission granted but never checked; SQL side:
-- checked but never granted). Not enforced by a DB CHECK constraint on
-- purpose (would defeat the migration-free-addition goal above); enforce it
-- with a test asserting the TS constant's value, same pattern as
-- hot-stint-store.test.ts's column-list assertions.
create table public.admin_permissions (
  user_id     uuid not null references auth.users(id) on delete cascade,
  permission  text not null,
  granted_at  timestamptz not null default now(),
  granted_by  uuid references auth.users(id),
  primary key (user_id, permission)
);

-- No policies. Every read of this table's contents happens through
-- has_admin_permission() below (security definer, bypasses RLS
-- internally) — including requirePermission() in app code, which calls it
-- via .rpc() rather than selecting the table directly. That means this
-- table needs no self-read policy the way drivers_select_own exists for
-- drivers — the function is the only access path, so a publicly-listable
-- "who has elevated access" row-set (the Supabase-default anon SELECT this
-- migration explicitly closes) never exists in the first place.
alter table public.admin_permissions enable row level security;
revoke all on public.admin_permissions from anon, authenticated;

-- ── has_admin_permission ────────────────────────────────────────────────
--
-- Single source of truth for "can the current user do X", used both by
-- in-app checks (requirePermission(), via .rpc()) and by RLS policies on
-- permission-scoped tables (bop_entries/bop_config below, and whatever
-- comes next). security definer so it can read admin_permissions/drivers
-- regardless of the caller's own RLS visibility into those tables — the
-- function's own logic is the access control, not table-level grants.
create or replace function public.has_admin_permission(perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from drivers d
      where d.user_id = auth.uid() and d.is_admin
    )
    or exists (
      select 1 from admin_permissions p
      where p.user_id = auth.uid() and p.permission = perm
    );
$$;

revoke all on function public.has_admin_permission(text) from public;
grant execute on function public.has_admin_permission(text) to authenticated;

-- ── RLS on bop_entries / bop_config ─────────────────────────────────────
--
-- Both tables already have RLS enabled with zero policies (checked
-- schema.sql before writing this) — deny-all for anon/authenticated,
-- currently moot only because every read AND write goes through the
-- service-role client (lib/public-bop.ts, admin/bop/actions.ts). This adds
-- the real backstop the section-permission work is supposed to close: even
-- if a future bug points a client-side/anon-key call at these tables
-- directly, only an admin or a 'bop'-permitted user can write.
--
-- No SELECT policy for anon/authenticated: confirmed with the product
-- owner 2026-08-25 that /about/custom-bop (the only public consumer) reads
-- via the service-role client, so these tables are not anon-reachable
-- today — adding `using (true)` would be a NET-NEW exposure with no
-- current consumer needing it, not a no-op. Leaving both tables at the
-- current effective deny-all for anon/authenticated SELECT; the service
-- role is unaffected (RLS never applies to it).
create policy bop_entries_write on public.bop_entries
  for all
  using (has_admin_permission('bop'))
  with check (has_admin_permission('bop'));

create policy bop_config_write on public.bop_config
  for all
  using (has_admin_permission('bop'))
  with check (has_admin_permission('bop'));
