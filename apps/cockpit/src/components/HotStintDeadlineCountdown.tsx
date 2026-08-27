'use client';

import { useEffect, useState } from 'react';
import { eventInstant } from '@/lib/event-time';

type Remaining = { days: number; hours: number; minutes: number; seconds: number };

function splitRemaining(ms: number): Remaining {
  const totalSeconds = Math.floor(ms / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

function DigitBlock({ value, label, delayS }: { value: number; label: string; delayS: number }) {
  return (
    <div className="flex-1 text-center border border-line bg-panel px-1.5 py-4">
      <span
        className="block font-mono font-bold text-[38px] text-txt tabular-nums tracking-[.01em] animate-[hsq-glow_2.6s_ease-in-out_infinite]"
        style={{ animationDelay: `${delayS}s` }}
      >
        {pad2(value)}
      </span>
      <span className="block mt-2 font-mono text-[10px] tracking-[.25em] uppercase text-[#E04040]">
        {label}
      </span>
    </div>
  );
}

// deadlineIso/opensIso are the authored Eastern wall-clock strings (from
// calendar_events.event_date/opens_at, looked up by slug — see
// lib/calendar-events-store.ts's getCalendarEventBySlug), resolved by the
// caller server-side and passed down: this component has no hardcoded date
// and no data fetch of its own. opensIso is optional — without it the
// progress bar is omitted and this is just the four digit blocks (matches
// the approved design: Direction A's pit-wall blocks + Direction B's
// elapsed-time bar underneath, see the design canvas this was built from).
// "Now" only exists client-side (server render would freeze the countdown
// at request time), so this renders nothing until mounted — same reasoning
// as CalendarGrid's month state. Renders nothing once the deadline has
// passed.
export function HotStintDeadlineCountdown({
  deadlineIso,
  opensIso,
  label = 'Hot Stint Qualifying closes in',
}: {
  deadlineIso: string;
  opensIso?: string | null;
  label?: string;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    setNow(Date.now());
    return () => clearInterval(id);
  }, []);

  if (now === null) return null;

  const deadlineMs = eventInstant(deadlineIso);
  const remainingMs = deadlineMs - now;
  if (remainingMs <= 0) return null;

  const remaining = splitRemaining(remainingMs);
  const opensMs = opensIso ? eventInstant(opensIso) : null;
  const elapsedPct =
    opensMs != null && deadlineMs > opensMs
      ? Math.min(100, Math.max(0, ((now - opensMs) / (deadlineMs - opensMs)) * 100))
      : null;

  return (
    <div className="border border-line bg-carbon-2 px-6 py-5 mb-8 relative overflow-hidden">
      <div
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{ background: '#E04040', boxShadow: '0 0 14px rgba(224,64,64,.55)' }}
      />
      <span className="block font-mono text-[11px] tracking-[.25em] uppercase text-txt-3 mb-4">
        {label}
      </span>
      <div className="flex gap-3">
        <DigitBlock value={remaining.days} label="Days" delayS={0} />
        <DigitBlock value={remaining.hours} label="Hrs" delayS={0.1} />
        <DigitBlock value={remaining.minutes} label="Min" delayS={0.2} />
        <DigitBlock value={remaining.seconds} label="Sec" delayS={0.3} />
      </div>

      {elapsedPct !== null && (
        <>
          <div className="mt-4 h-1 bg-line relative">
            <div
              className="absolute inset-y-0 left-0"
              style={{ width: `${elapsedPct}%`, background: 'linear-gradient(90deg,#c8941f,#E04040)' }}
            />
          </div>
          <div className="mt-2 flex justify-between font-mono text-[10px] tracking-[.15em] uppercase text-txt-3">
            <span>Window opened</span>
            <span>{Math.round(elapsedPct)}% elapsed</span>
          </div>
        </>
      )}
    </div>
  );
}
