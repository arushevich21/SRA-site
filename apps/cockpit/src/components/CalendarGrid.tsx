'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { eventDateTimeParts, eventInstant, hasEventTime } from '@/lib/event-time';

export type CalendarGridEvent = {
  // Authored schedule datetime (Eastern wall-clock, date-only = time TBA) —
  // kept as the raw string so server components can pass events across the
  // RSC boundary without Date serialization concerns.
  iso: string;
  title: string;
  href: string;
  color?: string;
};

const WEEKDAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// Which calendar day an event belongs to, plus its display time. Timed events
// land on the viewer's local day (a 9 PM ET race is the next day in Europe);
// date-only events are pinned to the authored (Eastern) date for everyone.
function placeEvent(e: CalendarGridEvent): { y: number; m: number; d: number; time: string | null } {
  if (hasEventTime(e.iso)) {
    const local = new Date(eventInstant(e.iso));
    return {
      y: local.getFullYear(),
      m: local.getMonth(),
      d: local.getDate(),
      time: eventDateTimeParts(e.iso).time,
    };
  }
  const [y, m, d] = e.iso.split('-').map(Number);
  return { y, m: m - 1, d, time: null };
}

function GridChrome({
  header,
  children,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-line bg-panel mb-14">
      <div className="flex items-center justify-between px-6 py-4 border-b border-line">
        {header}
      </div>
      <div className="grid grid-cols-7 border-b border-line">
        {WEEKDAY_LABELS.map((d) => (
          <div
            key={d}
            className="px-2 py-2 text-center font-mono text-[10px] tracking-[.2em] uppercase text-txt-3"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">{children}</div>
    </div>
  );
}

export function CalendarGrid({ events }: { events: CalendarGridEvent[] }) {
  // Which day a round lands on, and what time it reads as, depend on the
  // viewer's local timezone — the server can't know that, so day placement,
  // the "today" highlight, and event times only ever render client-side
  // rather than risk a server/client mismatch on any of it.
  const [month, setMonth] = useState<Date | null>(null);

  useEffect(() => {
    setMonth(startOfMonth(new Date()));
  }, []);

  const placed = useMemo(
    () => events.map((e) => ({ event: e, at: placeEvent(e) })),
    [events],
  );

  const cells = useMemo(() => {
    if (!month) return [];
    const firstWeekday = startOfMonth(month).getDay();
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

    return Array.from({ length: totalCells }, (_, i) => {
      const dayNum = i - firstWeekday + 1;
      if (dayNum < 1 || dayNum > daysInMonth) return null;
      return {
        day: dayNum,
        dayEvents: placed.filter(
          ({ at }) =>
            at.y === month.getFullYear() && at.m === month.getMonth() && at.d === dayNum,
        ),
      };
    });
  }, [month, placed]);

  if (!month) {
    // Pre-hydration skeleton: same chrome and cell height as the real grid so
    // nothing jumps when the month renders in.
    return (
      <GridChrome
        header={
          <span className="font-mono text-[12px] tracking-[.2em] uppercase text-txt-3">
            &nbsp;
          </span>
        }
      >
        {Array.from({ length: 35 }, (_, i) => (
          <div
            key={i}
            className={[
              'min-h-[92px] border-b border-r border-line/40 px-2 py-2',
              (i + 1) % 7 === 0 ? 'border-r-0' : '',
            ].join(' ')}
          />
        ))}
      </GridChrome>
    );
  }

  const monthLabel = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === month.getFullYear() && today.getMonth() === month.getMonth();

  return (
    <GridChrome
      header={
        <>
          <button
            type="button"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            className="font-mono text-[12px] tracking-[.2em] uppercase text-txt-3 hover:text-gold transition-colors px-2 cursor-pointer"
          >
            ← Prev
          </button>
          <span className="font-display font-bold text-[20px] uppercase tracking-[-0.5px] text-txt">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            className="font-mono text-[12px] tracking-[.2em] uppercase text-txt-3 hover:text-gold transition-colors px-2 cursor-pointer"
          >
            Next →
          </button>
        </>
      }
    >
      {cells.map((cell, i) => {
        const isToday = cell != null && isCurrentMonth && cell.day === today.getDate();
        return (
          <div
            key={i}
            className={[
              'min-h-[92px] border-b border-r border-line/40 px-2 py-2',
              (i + 1) % 7 === 0 ? 'border-r-0' : '',
              isToday ? 'bg-gold/10' : '',
            ].join(' ')}
          >
            {cell && (
              <>
                <span
                  className={[
                    'font-mono text-[11px]',
                    isToday ? 'text-gold font-bold' : 'text-txt-3',
                  ].join(' ')}
                >
                  {cell.day}
                </span>
                <div className="mt-1 flex flex-col gap-1">
                  {cell.dayEvents.map(({ event, at }, j) => (
                    <Link
                      key={j}
                      href={event.href}
                      title={at.time ? `${event.title} · ${at.time}` : event.title}
                      className="block border-l-2 bg-panel-2 px-1.5 py-[3px] hover:bg-panel transition-colors"
                      style={{ borderColor: event.color ?? 'var(--color-gold)' }}
                    >
                      <span className="block truncate font-mono text-[10px] tracking-[.05em] uppercase text-txt-2 hover:text-gold">
                        {event.title}
                      </span>
                      {at.time && (
                        <span className="block truncate font-mono text-[9px] tracking-[.05em] text-txt-3">
                          {at.time}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}
    </GridChrome>
  );
}
