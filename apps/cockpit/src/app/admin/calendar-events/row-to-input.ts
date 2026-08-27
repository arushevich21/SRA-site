import type { CalendarEventRow } from '@/lib/calendar-events-store';
import type { CalendarEventInput } from './actions';

export function rowToInput(row: CalendarEventRow): CalendarEventInput {
  return {
    id: row.id,
    slug: row.slug ?? '',
    title: row.title,
    description: row.description ?? '',
    eventDate: row.eventDate,
    opensAt: row.opensAt ?? '',
    game: row.game ?? '',
    eventType: row.eventType,
    href: row.href ?? '',
    color: row.color ?? '',
    sortOrder: row.sortOrder,
  };
}
