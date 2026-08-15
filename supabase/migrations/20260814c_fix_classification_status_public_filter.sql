-- Fixes classification_status_public: the version that actually ran live
-- was an earlier draft of 20260814b filtered on `hotstint_ms is not null`
-- only, missing the `eligible = true` condition added after review (see
-- 20260814b's inline comment for the full reasoning — a driver can set a
-- lap time on the open-practice server without completing classification
-- signup, and showing them ranked then having them vanish once divisions
-- publish is worse than never showing them).
--
-- CREATE OR REPLACE VIEW, not DROP + CREATE: the column list/types are
-- unchanged (only the WHERE clause differs), which Postgres allows in place
-- — no need to drop and lose the view's ACL/ownership state, and nothing
-- else needs to be recreated.
--
-- Column split reasoning, RLS/grant posture (security_invoker + explicit
-- revoke), and the "do not simplify this filter" warning are all unchanged
-- from 20260814b — see that migration for the full explanation. Repeated
-- here only for what's actually different.
create or replace view public.classification_status_public
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

-- Re-asserted, not assumed still in place: CREATE OR REPLACE VIEW does not
-- touch privileges, so the revoke that already ran as part of 20260814b
-- should still hold — but this is cheap insurance against exactly the kind
-- of "which version actually ran" uncertainty that caused this migration to
-- be needed in the first place.
revoke all on public.classification_status_public from anon, authenticated;
