import { fromZonedTime } from 'date-fns-tz';

// Schedule times in the content layer (championships.ts) are authored as
// naked ISO strings meaning wall-clock time in this zone. This module is the
// only place that interpretation lives — every event time shown anywhere on
// the site must go through it. Never call `new Date(iso)` on an authored
// schedule string directly: that parses it in whatever timezone the runtime
// happens to be in (UTC on Vercel, the visitor's zone in the browser).
export const EVENT_SOURCE_TIMEZONE = 'America/New_York';

// Entries without a 'T' are date-only (time TBA).
export function hasEventTime(iso: string): boolean {
  return iso.includes('T');
}

// Absolute instant (epoch ms) for an authored Eastern wall-clock datetime.
// DST-aware via the IANA zone: summer dates resolve to EDT (UTC-4), winter
// to EST (UTC-5) automatically.
export function eventInstant(iso: string): number {
  return fromZonedTime(iso, EVENT_SOURCE_TIMEZONE).getTime();
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
};
const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
};

export type EventDateTimeParts = { date: string; time: string | null };

// Formats an authored schedule entry for display, always with an explicit
// timezone abbreviation on the time ("9:00 PM EDT", "6:00 PM PDT").
//
// `timeZone` pins the output zone. Omit it to resolve the runtime's zone —
// only do that in the browser, where "runtime" means the visitor's device;
// on the server, always pin (EVENT_SOURCE_TIMEZONE for the SSR fallback).
//
// Date-only entries have no instant, so they render as the authored calendar
// date for every viewer regardless of zone.
export function eventDateTimeParts(
  iso: string | null,
  timeZone?: string,
): EventDateTimeParts {
  if (!iso) return { date: 'TBA', time: null };
  if (!hasEventTime(iso)) return { date: formatDateOnly(iso), time: null };
  const d = new Date(eventInstant(iso));
  return {
    date: d.toLocaleDateString('en-US', { ...DATE_FORMAT, timeZone }),
    time: d.toLocaleTimeString('en-US', { ...TIME_FORMAT, timeZone }),
  };
}

function formatDateOnly(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    ...DATE_FORMAT,
    timeZone: 'UTC',
  });
}

/**
 * Shifts an authored event date by whole days, preserving wall-clock time.
 *
 * For split-night series: division 2 races the day after the round's own date,
 * at the same local time. See championship_division_nights (20260914e).
 *
 * Operates on the STRING, not on an instant. Converting to a Date, adding 24h
 * and converting back would silently move the wall-clock hour across a DST
 * boundary — a round on 2026-11-03T21:00 would come back 20:00 or 22:00 the
 * next day, because those two local days are not 24 hours apart. Racing is
 * scheduled in wall-clock ("9 PM Eastern"), so the hour must survive untouched
 * and only the calendar date moves.
 *
 * Date-only input stays date-only. Returns the input unchanged for days === 0.
 */
export function addDaysToEventDate(iso: string, days: number): string {
  if (days === 0) return iso;

  const timeIndex = iso.indexOf('T');
  const datePart = timeIndex === -1 ? iso : iso.slice(0, timeIndex);
  const timePart = timeIndex === -1 ? '' : iso.slice(timeIndex);

  const [y, m, d] = datePart.split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return iso;

  // UTC arithmetic purely as a calendar calculator — it handles month and year
  // rollover for us and, being UTC, has no DST of its own to interfere.
  const shifted = new Date(Date.UTC(y, m - 1, d));
  shifted.setUTCDate(shifted.getUTCDate() + days);

  const yyyy = String(shifted.getUTCFullYear()).padStart(4, '0');
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(shifted.getUTCDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}${timePart}`;
}
