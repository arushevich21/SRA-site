import { EVENT_SOURCE_TIMEZONE, eventDateTimeParts } from '@/lib/event-time';

// Presentation helpers for schedule dates/times. Kept out of the content layer
// (content/championships.ts) so that file stays pure data with no imports —
// which lets scripts (e.g. seed-championships) import it directly.

// Date and time split apart so callers (e.g. calendar rows) can give the
// date/time more visual weight than the surrounding duration/format text.
// Pinned to Eastern so it's deterministic across server and client — use it
// for SSR fallbacks; viewer-local display goes through LocalScheduleDateTime.
export function formatScheduleDateTime(date: string | null): { date: string; time: string | null } {
  return eventDateTimeParts(date, EVENT_SOURCE_TIMEZONE);
}

export function formatScheduleDate(date: string | null): string {
  const { date: dateStr, time } = formatScheduleDateTime(date);
  return time ? `${dateStr} · ${time}` : dateStr;
}
