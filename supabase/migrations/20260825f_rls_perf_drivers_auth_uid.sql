-- RLS performance fix, found via a supabase-postgres-best-practices skill
-- audit (2026-08-25): three places call auth.uid() unwrapped inside a USING/
-- WITH CHECK clause. Per Supabase's own RLS performance guidance, a bare
-- auth.uid() can be re-evaluated once per row scanned; wrapping it in
-- `(select auth.uid())` lets Postgres cache it once per statement (an
-- InitPlan) instead. Also adds the missing index this compounds with:
-- drivers.user_id has a FK constraint to auth.users but no index (a plain FK
-- does not auto-create one — only PRIMARY KEY/UNIQUE do), so every query
-- filtered on it — these three RLS policies, plus middleware.ts's
-- steam_verified check on every logged-in page load, plus profile/actions.ts
-- and [sim]/register/actions.ts's driver lookups — was a full sequential
-- scan of the table, not an index scan.
--
-- drivers is small (low hundreds of rows, per this session's earlier
-- driver_ratings backfill counts) — CREATE INDEX takes a brief lock, no
-- CONCURRENTLY needed at this scale, so it's safe inside the same
-- transaction as the policy/function changes below.
--
-- No behavior change: every predicate is logically identical, only the
-- evaluation strategy changes. Safe to run without a backfill or dry-run
-- count — this touches query plans, not data.

BEGIN;

-- 1. has_admin_permission(): wrap both auth.uid() calls. Used by
--    bop_config_write / bop_entries_write (see 20260825c_admin_permissions.sql).
CREATE OR REPLACE FUNCTION public.has_admin_permission(perm text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    exists (
      select 1 from drivers d
      where d.user_id = (select auth.uid()) and d.is_admin
    )
    or exists (
      select 1 from admin_permissions p
      where p.user_id = (select auth.uid()) and p.permission = perm
    );
$$;

-- 2. drivers' three "own row" policies: wrap auth.uid() on the RLS side too.
ALTER POLICY drivers_insert_own ON public.drivers
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY drivers_select_own ON public.drivers
  USING ((select auth.uid()) = user_id);

ALTER POLICY drivers_update_own ON public.drivers
  USING ((select auth.uid()) = user_id);

-- 3. Missing index backing all of the above (and every other user_id lookup
--    against drivers).
CREATE INDEX IF NOT EXISTS drivers_user_id_idx ON public.drivers (user_id);

COMMIT;
