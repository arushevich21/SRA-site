-- Admin-managed calendar entries that aren't tied to a championship round —
-- classification deadlines, reveal streams, announcements, etc. Read-only to
-- everyone (calendar_events_select_all, same pattern as championships_
-- select_all); there is no client-writable INSERT/UPDATE/DELETE policy on
-- purpose — all writes go through the admin panel's server actions on the
-- service-role client (requireAdmin()-gated), same as championships/
-- championship_rounds.
CREATE TABLE public.calendar_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    title text NOT NULL,
    description text,
    -- Naked ISO wall-clock string, same authored convention as
    -- championship_rounds.starts_at (see lib/event-time.ts's header):
    -- 'YYYY-MM-DD' = date-only (time TBA), 'YYYY-MM-DDThh:mm:ss' = date+time,
    -- both interpreted as America/New_York and resolved DST-aware downstream.
    event_date text NOT NULL,
    -- NULL = cumulative calendar (/calendar) only. Set to a sims.ts `game`
    -- string (e.g. 'ACC') to also show on that sim's own calendar
    -- (/[sim]/calendar). Free text, not FK'd to a table, matching how
    -- championships.game already works — sim identity lives in the TS
    -- content layer (content/sims.ts), not the database.
    game text,
    event_type text DEFAULT 'event' NOT NULL,
    href text,
    color text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT calendar_events_event_type_check
        CHECK (event_type IN ('event', 'deadline', 'stream', 'announcement'))
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY calendar_events_select_all ON public.calendar_events
    FOR SELECT USING (true);
