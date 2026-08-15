-- teams_unique_name_per_season (added in 20260814f) is redundant: a
-- pre-existing unique index, teams_name_unique, already enforces
-- (series, season, lower(name)) — case-INSENSITIVE, strictly stricter than
-- 20260814f's case-sensitive (series, season, name). I didn't check for
-- existing indexes on teams before proposing 20260814f; confirmed live via
-- \d teams / pg_indexes after the fact, not caught by the earlier
-- BEGIN/ROLLBACK syntax check (that only proves the statement runs, not
-- that it adds anything new). No functional harm happened — duplicate
-- names were still correctly blocked, just by the older index winning
-- first — but there's no reason to keep two unique indexes doing
-- overlapping work.
--
-- PROPOSED — NOT RUN.

-- Was added via ADD CONSTRAINT (not a bare CREATE UNIQUE INDEX), so the
-- matching removal is DROP CONSTRAINT — that also removes the constraint's
-- backing index in one step.
alter table public.teams drop constraint if exists teams_unique_name_per_season;
