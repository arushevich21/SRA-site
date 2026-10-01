-- registration_drivers.driver_category: derive on every insert, follow tier.
--
-- ── What was wrong ───────────────────────────────────────────────────────
--
-- 20260922 moved the derivation into register_entry(), but only as a fallback:
-- an explicit driver_category in the payload still wins. The matching site
-- change (lib/registrations.ts: `?? 1` -> `?? null`) never shipped, so the
-- deployed site kept sending 1 for every driver and every post-backfill
-- signup landed Silver regardless of tier. Six S19 golds were on the grid as
-- Silver by 2026-09-30 (Lindo, Chan, Bat, Gale, Koneru, Koval).
--
-- Separately, the value is a write-time snapshot: a driver registered before
-- their tier was assigned (NULL -> Silver), or promoted after registering,
-- stayed Silver until someone re-ran the 20260922 backfill by hand.
--
-- ── The fix: two triggers, no caller trust ───────────────────────────────
--
-- 1. BEFORE INSERT on registration_drivers: driver_category is always
--    acc_driver_category(drivers.tier), whatever the caller sent. Covers
--    register_entry(), the bot and any admin insert, and makes a stale site
--    deploy harmless. register_entry()'s explicit-value branch is now inert;
--    a one-off override is an UPDATE after insert, which this does not touch.
--
-- 2. AFTER UPDATE OF tier on drivers: re-derive that driver's rows in every
--    non-concluded championship. Only rows still on the OLD tier's derived
--    value move — a hand-set override (e.g. gt3-liaw's) is left alone. The
--    UPDATE fires registration_drivers_entrylist_push_update, so ACCSM gets
--    the corrected grid without a manual push.
--
-- ── One transaction per step, deliberately ───────────────────────────────
--
-- The first attempt ran as one BEGIN/COMMIT and deadlocked (40P01): it held
-- registration_drivers' trigger lock while waiting for AccessExclusive on
-- drivers, and a live reader (bot entrylist build joins both) held drivers
-- while waiting on registration_drivers. The steps are now
-- three separate transactions (explicit BEGIN/COMMIT each, because the
-- Supabase SQL editor otherwise runs a multi-statement script as ONE implicit
-- transaction), so we never hold one table while queueing for the other.
-- Every step is idempotent and safe alone; lock_timeout makes a busy table
-- fail fast — just re-run the file.

SET lock_timeout = '5s';

-- ── Step 1: derive on insert (locks registration_drivers only) ──
BEGIN;

CREATE OR REPLACE FUNCTION public.registration_drivers_derive_category()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.driver_category := public.acc_driver_category(
    (SELECT tier FROM drivers WHERE id = NEW.driver_id));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS registration_drivers_derive_category ON public.registration_drivers;
CREATE TRIGGER registration_drivers_derive_category
  BEFORE INSERT ON public.registration_drivers
  FOR EACH ROW EXECUTE FUNCTION public.registration_drivers_derive_category();

COMMIT;

-- ── Step 2: follow tier changes (locks drivers only) ──
BEGIN;

CREATE OR REPLACE FUNCTION public.sync_driver_category_on_tier_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE registration_drivers rd
     SET driver_category = public.acc_driver_category(NEW.tier)
   WHERE rd.driver_id = NEW.id
     AND rd.driver_category = public.acc_driver_category(OLD.tier)
     AND rd.driver_category IS DISTINCT FROM public.acc_driver_category(NEW.tier)
     AND EXISTS (
       SELECT 1 FROM championships c
        WHERE c.registration_key = rd.championship_key
          AND NOT c.concluded
     );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS drivers_sync_driver_category ON public.drivers;
CREATE TRIGGER drivers_sync_driver_category
  AFTER UPDATE OF tier ON public.drivers
  FOR EACH ROW
  WHEN (OLD.tier IS DISTINCT FROM NEW.tier)
  EXECUTE FUNCTION public.sync_driver_category_on_tier_change();

COMMIT;

-- ── Step 3: repair the live S19 grid (same scope and rule as 20260922) ──
BEGIN;

UPDATE public.registration_drivers rd
   SET driver_category = public.acc_driver_category(d.tier)
  FROM public.drivers d
 WHERE d.id = rd.driver_id
   AND rd.championship_key = 'acc-gt3-s19'
   AND rd.driver_category IS DISTINCT FROM public.acc_driver_category(d.tier);

COMMIT;
