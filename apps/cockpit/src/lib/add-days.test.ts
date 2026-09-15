import { describe, it, expect } from 'vitest';
import { addDaysToEventDate, eventInstant } from './event-time.js';

describe('addDaysToEventDate', () => {
  it('moves the date and keeps the wall-clock time', () => {
    expect(addDaysToEventDate('2026-09-22T21:00:00', 1)).toBe('2026-09-23T21:00:00');
  });

  it('returns the input unchanged for a zero offset', () => {
    expect(addDaysToEventDate('2026-09-22T21:00:00', 0)).toBe('2026-09-22T21:00:00');
  });

  it('keeps a date-only round date-only', () => {
    expect(addDaysToEventDate('2026-09-22', 1)).toBe('2026-09-23');
  });

  it('rolls over month and year boundaries', () => {
    expect(addDaysToEventDate('2026-10-31T21:00:00', 1)).toBe('2026-11-01T21:00:00');
    expect(addDaysToEventDate('2026-12-31T21:00:00', 1)).toBe('2027-01-01T21:00:00');
  });

  it('preserves 9 PM across the US DST boundary', () => {
    // 2026-11-01 is the US fall-back. A naive "+24h on the instant" would
    // return 20:00 or 22:00 here; racing is scheduled in wall-clock, so the
    // hour must survive and only the date move.
    expect(addDaysToEventDate('2026-10-31T21:00:00', 1)).toBe('2026-11-01T21:00:00');
    expect(addDaysToEventDate('2026-11-01T21:00:00', 1)).toBe('2026-11-02T21:00:00');
  });

  it('the shifted date really is 9 PM Eastern on both sides of DST', () => {
    // The real assertion behind the one above: interpreted through
    // event-time's Eastern conversion, both land on 21:00 local.
    const before = new Date(eventInstant('2026-10-31T21:00:00'));
    const after = new Date(eventInstant(addDaysToEventDate('2026-10-31T21:00:00', 1)));
    const hourIn = (d: Date) =>
      d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/New_York' });
    expect(hourIn(before)).toBe(hourIn(after));
    // ...and they are 25 hours apart in real time, not 24, which is exactly
    // why string arithmetic is required here.
    expect(after.getTime() - before.getTime()).toBe(25 * 60 * 60 * 1000);
  });

  it('handles multi-day offsets', () => {
    expect(addDaysToEventDate('2026-09-22T21:00:00', 3)).toBe('2026-09-25T21:00:00');
  });
});
