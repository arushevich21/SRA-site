-- Migration: signed-in users and anon can no longer write to drivers.
-- Run in Supabase SQL editor AFTER the site change that moves the profile save
-- to the service role has deployed (otherwise profile saves fail until it does).
--
-- Why: drivers_update_own let a user update ANY column of their own row, and
-- the table-level grant covered every column. The site ships a browser Supabase
-- client carrying the user's session, so any signed-in driver could run
--   supabase.from('drivers').update({ is_admin: true }).eq('user_id', <self>)
-- and pass requireAdmin(). The same path reached:
--   * has_admin_permission()  — reads drivers.is_admin (BoP writes)
--   * stw_current_driver_id() — resolves the steward by drivers.discord_id, so
--     copying a steward's discord_id onto your own row made you that steward
--   * is_champion, steam_verified, division_id, tier, driver_number
--
-- Every legitimate write to drivers goes through the service role (site server
-- actions, auth callbacks, SRA-Bot), which bypasses grants and RLS. Reads are
-- unchanged.

begin;

revoke insert, update, delete, truncate on public.drivers from anon, authenticated;

-- With no write grant these policies can never apply; drop them so nobody
-- reads them later as "users may edit their own row".
drop policy if exists drivers_insert_own on public.drivers;
drop policy if exists drivers_update_own on public.drivers;

-- Verify: should return no rows.
select grantee, privilege_type
from   information_schema.role_table_grants
where  table_schema = 'public' and table_name = 'drivers'
  and  grantee in ('anon', 'authenticated')
  and  privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');

commit;

-- After running: .\scripts\dump-schema.ps1 (schema.sql excludes grants, but
-- the dropped policies will show in the diff).
