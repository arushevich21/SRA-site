import { describe, it, expect } from 'vitest';
import {
  EVENT_SOURCE_TIMEZONE,
  eventDateTimeParts,
  eventInstant,
  hasEventTime,
} from './event-time.js';

describe('eventInstant — Eastern wall-clock → absolute instant', () => {
  it('resolves summer dates as EDT (UTC-4)', () => {
    // 9:00 PM ET on Jul 6 = 1:00 AM UTC on Jul 7
    expect(eventInstant('2026-07-06T21:00:00')).toBe(Date.UTC(2026, 6, 7, 1, 0, 0));
  });

  it('resolves winter dates as EST (UTC-5)', () => {
    // 8:30 PM ET on Jan 15 = 1:30 AM UTC on Jan 16
    expect(eventInstant('2026-01-15T20:30:00')).toBe(Date.UTC(2026, 0, 16, 1, 30, 0));
  });

  it('handles the spring-forward boundary (DST starts Mar 8, 2026)', () => {
    // Night before the transition: still EST (UTC-5)
    expect(eventInstant('2026-03-07T21:00:00')).toBe(Date.UTC(2026, 2, 8, 2, 0, 0));
    // Night after: EDT (UTC-4)
    expect(eventInstant('2026-03-08T21:00:00')).toBe(Date.UTC(2026, 2, 9, 1, 0, 0));
  });

  it('handles the fall-back boundary (DST ends Nov 1, 2026)', () => {
    // Night before the transition: still EDT (UTC-4)
    expect(eventInstant('2026-10-31T21:00:00')).toBe(Date.UTC(2026, 10, 1, 1, 0, 0));
    // Night after: EST (UTC-5)
    expect(eventInstant('2026-11-01T21:00:00')).toBe(Date.UTC(2026, 10, 2, 2, 0, 0));
  });
});

describe('eventDateTimeParts — formatting with explicit zone label', () => {
  it('formats pinned to Eastern with the correct DST abbreviation', () => {
    expect(eventDateTimeParts('2026-07-06T21:00:00', EVENT_SOURCE_TIMEZONE)).toEqual({
      date: 'Mon, Jul 6',
      time: '9:00 PM EDT',
    });
    expect(eventDateTimeParts('2026-01-15T20:30:00', EVENT_SOURCE_TIMEZONE)).toEqual({
      date: 'Thu, Jan 15',
      time: '8:30 PM EST',
    });
  });

  it('formats the same instant correctly in other viewer zones', () => {
    // 9:00 PM ET = 6:00 PM PT same evening
    expect(eventDateTimeParts('2026-07-06T21:00:00', 'America/Los_Angeles')).toEqual({
      date: 'Mon, Jul 6',
      time: '6:00 PM PDT',
    });
    // ...and 2:00 AM the NEXT day in the UK (en-US renders BST as GMT+1)
    expect(eventDateTimeParts('2026-07-06T21:00:00', 'Europe/London')).toEqual({
      date: 'Tue, Jul 7',
      time: '2:00 AM GMT+1',
    });
  });

  it('renders date-only entries as the authored date in every zone, with no time', () => {
    expect(eventDateTimeParts('2026-08-01', 'America/Los_Angeles')).toEqual({
      date: 'Sat, Aug 1',
      time: null,
    });
    expect(eventDateTimeParts('2026-08-01', 'Pacific/Auckland')).toEqual({
      date: 'Sat, Aug 1',
      time: null,
    });
  });

  it('renders null as TBA', () => {
    expect(eventDateTimeParts(null)).toEqual({ date: 'TBA', time: null });
  });
});

describe('hasEventTime', () => {
  it('distinguishes datetime from date-only entries', () => {
    expect(hasEventTime('2026-07-06T21:00:00')).toBe(true);
    expect(hasEventTime('2026-08-01')).toBe(false);
  });
});
