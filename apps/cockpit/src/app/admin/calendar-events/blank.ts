import type { CalendarEventInput } from './actions';

export function blankInput(): CalendarEventInput {
  return {
    slug: '',
    title: '',
    description: '',
    eventDate: '',
    opensAt: '',
    game: '',
    eventType: 'event',
    href: '',
    color: '',
    sortOrder: 0,
  };
}
