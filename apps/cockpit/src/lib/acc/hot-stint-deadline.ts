// Key into calendar_events.slug for the Hot Stint Qualifying countdown shown
// on the Hot Stint Qualifying and #Jagoff pages — the actual date lives in
// the DB (admin-editable via /admin/calendar-events), not here. See
// supabase/migrations/20260827b_calendar_events_slug.sql for why slug exists
// at all: it's only needed for rows code looks up directly, as opposed to
// calendar_events rows that only ever render on the calendar grid.
export const HOT_STINT_QUALIFYING_DEADLINE_SLUG = 'acc-hot-stint-qualifying-deadline';
