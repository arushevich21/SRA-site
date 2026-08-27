-- Optional stable key for calendar_events rows that code needs to look up
-- directly (e.g. the Hot Stint Qualifying countdown), as opposed to rows that
-- only ever render on the calendar grid and need no code-side reference.
-- Plain UNIQUE (not a partial index) is fine here — Postgres already treats
-- multiple NULLs as distinct under a standard UNIQUE constraint, so any
-- number of slug-less rows coexist without conflict.
ALTER TABLE public.calendar_events ADD COLUMN slug text UNIQUE;
