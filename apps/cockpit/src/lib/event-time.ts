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
