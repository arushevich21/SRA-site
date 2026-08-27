-- Optional window-start companion to event_date, for deadline-type events
-- that want a progress bar (elapsed time toward the deadline) rather than
-- just a countdown. Same naked-ISO Eastern wall-clock convention as
-- event_date/starts_at (see lib/event-time.ts). NULL = no progress bar —
-- HotStintDeadlineCountdown falls back to digit blocks only.
ALTER TABLE public.calendar_events ADD COLUMN opens_at text;
