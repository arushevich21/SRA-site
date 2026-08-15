-- Public projection of classification_status for the Hot Stint Qualifying
-- leaderboard tab, built directly over the bot's data (classification_status
-- — see 20260814_drop_hot_stint_ingest.sql's header for why the acc-web
-- ingest was dropped in favor of this).
--
-- PRIVACY (hard requirement, unchanged from the original spec): per-driver
-- lap counts are admin-only, permanently — not public, not visible to the
-- driver themself. classification_status carries far more than lap counts
-- though (discord_id, steam_id, rating internals) — see the live leak fixed
-- in this same investigation (classification_status previously had no
-- security_invoker and a live anon grant). This view is the same fix
-- pattern applied deliberately from the start, not remediated after the
-- fact: security_invoker = true (so it re-checks RLS/grants as the querying
-- role, not the view owner) plus an explicit revoke, exactly like
-- hot_stint_results_public before it.
--
-- Column split (all 17 columns of classification_status, every one
-- classified — see hot-stint-store.test.ts's coverage assertion):
--   PUBLIC: series, season (scoping), first_name, last_name (the display
--     name — literally what's exposed, just not concatenated in SQL so the
--     app can format it), hotstint_ms.
--   ADMIN-ONLY: discord_id, driver_id, steam_id, has_signup, has_account,
--     has_hotstint, eligible, num_laps, is_returning, srating_ordinal,
--     composite, pace_pct.
-- No position column — the public store function computes it from
-- ORDER BY hotstint_ms, same convention as the old hot_stint_results_public
-- caller used.
--
-- Filtered on eligible = true, NOT on "hotstint_ms is not null" alone. This
-- board ranks people actually being classified into divisions — a driver
-- who set a lap time on the open-practice server without completing
-- classification signup (has_signup = false) is not in that pool.
-- eligible = has_signup AND has_account AND has_hotstint (see
-- classification_status's definition), so eligible = true already implies
-- hotstint_ms is not null; the second condition below is kept anyway for
-- explicitness, not because it narrows anything further.
--
-- DO NOT "SIMPLIFY" THIS BACK TO hotstint_ms IS NOT NULL. In today's data
-- every has_hotstint=true row also happens to have eligible=true, so the two
-- filters currently return identical rows — that's a coincidence of the
-- current 45-row season, not a guarantee. A driver can run laps on a
-- multi-week open-practice server without ever completing signup; showing
-- them ranked and then having them silently vanish once divisions publish
-- is worse than never showing them. eligible is the correct filter for "is
-- this driver in the pool being classified" — hotstint_ms alone only means
-- "this driver has a time on file".
--
-- eligible is a FILTER column, not a SELECTed one — it is deliberately
-- absent from the column list below and must stay that way; it does not
-- appear in PUBLIC_CLASSIFICATION_COLUMNS in hot-stint-store.ts either.
create view public.classification_status_public
  with (security_invoker = true)
as
  select
    series,
    season,
    first_name,
    last_name,
    hotstint_ms
  from public.classification_status
  where eligible = true
    and hotstint_ms is not null;

comment on view public.classification_status_public is
  'Public-safe projection of classification_status for the Hot Stint '
  'Qualifying leaderboard tab. Filtered on eligible = true (the pool '
  'actually being classified), not hotstint_ms is not null — do not '
  '"simplify" this filter, see the view''s inline comment. Never adds '
  'steam_id, discord_id, driver_id, num_laps, or rating internals '
  '(composite/pace_pct/srating_ordinal) — those stay admin-only, '
  'permanently. The admin view reads classification_status directly '
  'through the service-role client; no separate admin view is needed since '
  'that table is already RLS/grant-protected.';

revoke all on public.classification_status_public from anon, authenticated;
