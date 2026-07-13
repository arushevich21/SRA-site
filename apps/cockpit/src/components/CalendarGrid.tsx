'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

export type CalendarGridEvent = {
  date: Date;
  hasTime: boolean;
  title: string;
  href: string;
  color?: string;
};

const WEEKDAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function eventTime(e: CalendarGridEvent): string | null {
  if (!e.hasTime) return null;
  return e.date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
}

export function CalendarGrid({ events }: { events: CalendarGridEvent[] }) {
  // Which day a round lands on, and what time it reads as, depend on the
  // viewer's local timezone — the server can't know that, so the whole grid
  // (month math, "today" highlight, event times) only ever renders client-side
  // rather than risk a server/client mismatch on any of it.
  const [mounted, setMounted] = useState(false);
  const [month, setMonth] = useState<Date | null>(null);

  useEffect(() => {
    setMonth(startOfMonth(new Date()));
    setMounted(true);
  }, []);

  const cells = useMemo(() => {
    if (!month) return [];
    const first = startOfMonth(month);
    const firstWeekday = first.getDay();
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

    return Array.from({ length: totalCells }, (_, i) => {
      const dayNum = i - firstWeekday + 1;
      if (dayNum < 1 || dayNum > daysInMonth) return null;
      const date = new Date(month.getFullYear(), month.getMonth(), dayNum);
      return { date, dayEvents: events.filter((e) => isSameDay(e.date, date)) };
    });
  }, [month, events]);

  if (!mounted || !month) {
    return (
      <div className="border border-line bg-panel mb-14 min-h-[420px] flex items-center justify-center">
        <span className="font-mono text-[12px] tracking-[.2em] uppercase text-txt-3">
          Loading calendar…
        </span>
      </div>
    );
  }

  const monthLabel = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const today = new Date();

  return (
    <div className="border border-line bg-panel mb-14">
      <div className="flex items-center justify-between px-6 py-4 border-b border-line">
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

      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          const isToday = cell != null && isSameDay(cell.date, today);
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
                    {cell.date.getDate()}
                  </span>
                  <div className="mt-1 flex flex-col gap-1">
                    {cell.dayEvents.map((e, j) => {
                      const time = eventTime(e);
                      return (
                        <Link
                          key={j}
                          href={e.href}
                          title={time ? `${e.title} · ${time}` : e.title}
                          className="block border-l-2 bg-panel-2 px-1.5 py-[3px] hover:bg-panel transition-colors"
                          style={{ borderColor: e.color ?? 'var(--color-gold)' }}
                        >
                          <span className="block truncate font-mono text-[10px] tracking-[.05em] uppercase text-txt-2 hover:text-gold">
                            {e.title}
                          </span>
                          {time && (
                            <span className="block truncate font-mono text-[9px] tracking-[.05em] text-txt-3">
                              {time}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
