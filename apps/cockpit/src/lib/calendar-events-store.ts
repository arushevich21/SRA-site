import 'server-only';
import { supabase } from './supabase';

// Admin-managed calendar entries not tied to a championship round — see
// supabase/migrations/20260827_calendar_events.sql. `game` null means
// cumulative-calendar-only; set to a sims.ts `game` string (e.g. 'ACC') to
// also show on that sim's own calendar page.
export type CalendarEventRow = {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  eventDate: string; // authored Eastern wall-clock ISO — see lib/event-time.ts
  // Optional window-start companion to eventDate — lets a deadline-type
  // event drive an elapsed-time progress bar (see HotStintDeadlineCountdown)
  // instead of just a raw countdown. Null for events with no meaningful
  // "opens" point (streams, announcements, most deadlines).
  opensAt: string | null;
  game: string | null;
  eventType: 'event' | 'deadline' | 'stream' | 'announcement';
  href: string | null;
  color: string | null;
  sortOrder: number;
};

const COLS =
  'id, slug, title, description, event_date, opens_at, game, event_type, href, color, sort_order';

function mapRow(r: Record<string, unknown>): CalendarEventRow {
  return {
    id: r.id as string,
    slug: r.slug as string | null,
    title: r.title as string,
    description: r.description as string | null,
    eventDate: r.event_date as string,
    opensAt: r.opens_at as string | null,
    game: r.game as string | null,
    eventType: r.event_type as CalendarEventRow['eventType'],
    href: r.href as string | null,
    color: r.color as string | null,
    sortOrder: r.sort_order as number,
  };
}

// Every calendar_events row — used by the cumulative /calendar page (shows
// all of them) and filtered client-side by callers that only want one game's
// events (see /[sim]/calendar).
export async function getCalendarEvents(): Promise<CalendarEventRow[]> {
  const { data, error } = await supabase
    .from('calendar_events')
    .select(COLS)
    .order('event_date', { ascending: true });
  if (error) {
    console.error('calendar_events read failed:', error.message);
    return [];
  }
  return (data ?? []).map(mapRow);
}

// Looked up by code that needs one specific admin-managed event (e.g. the
// Hot Stint Qualifying countdown) rather than just rendering the calendar
// grid — see the slug column's migration comment. Returns null both when the
// row doesn't exist and on a read error, since callers treat "nothing to
// show" as the same case either way.
export async function getCalendarEventBySlug(slug: string): Promise<CalendarEventRow | null> {
  const { data, error } = await supabase
    .from('calendar_events')
    .select(COLS)
    .eq('slug', slug)
    .maybeSingle();
  if (error) {
    console.error('calendar_events slug lookup failed:', error.message);
    return null;
  }
  return data ? mapRow(data) : null;
}

// ── Admin reads/writes ──

export async function getCalendarEventById(id: string): Promise<CalendarEventRow | null> {
  const { data, error } = await supabase
    .from('calendar_events')
    .select(COLS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRow(data) : null;
}
