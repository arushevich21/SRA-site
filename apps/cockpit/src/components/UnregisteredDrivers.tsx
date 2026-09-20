'use client';

import { useState } from 'react';
import { DivisionBadge } from './DivisionBadge';
import { DriverTierBadge } from './DriverTierBadge';
import type { UnregisteredDivisionRow } from '@/lib/unregistered-drivers';

// "Still to Register" — one card per division on the register page, sitting
// under the Signed Up capacity strip and sharing its grid and card chrome so
// the two read as a pair: Signed Up says how full a division is against its
// pit-box cap; this says who from the division's roster hasn't turned up yet.
// Aimed at whoever is chasing sign-ups before the deadline, so the list is
// the point — names first, collapsed to a handful per card with a toggle.

const COLLAPSED_ROWS = 6;

export function UnregisteredDrivers({ rows }: { rows: UnregisteredDivisionRow[] }) {
  if (rows.length === 0) return null;

  const totalRoster = rows.reduce((s, r) => s + r.rosterCount, 0);
  const totalUnregistered = rows.reduce((s, r) => s + r.unregistered.length, 0);
  if (totalRoster === 0) return null;

  return (
    <div className="mb-10">
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <p className="font-mono text-[11px] tracking-[.3em] uppercase text-txt-3">Still to Register</p>
        <p className="font-mono text-[11px] text-txt-3 tabular-nums">
          <span className={totalUnregistered === 0 ? 'text-gold' : 'text-txt'}>{totalUnregistered}</span> of{' '}
          {totalRoster} graded drivers
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {rows.map((r) => (
          <DivisionCard key={r.divisionId} row={r} />
        ))}
      </div>
    </div>
  );
}

function DivisionCard({ row }: { row: UnregisteredDivisionRow }) {
  const [expanded, setExpanded] = useState(false);
  const missing = row.unregistered.length;
  const pct = row.rosterCount > 0 ? (row.registeredCount / row.rosterCount) * 100 : 0;
  const complete = row.rosterCount > 0 && missing === 0;
  const visible = expanded ? row.unregistered : row.unregistered.slice(0, COLLAPSED_ROWS);
  const hidden = missing - visible.length;

  return (
    <div className="border border-line bg-panel px-4 py-3 flex flex-col">
      <div className="mb-2 h-[26px] flex items-center justify-between gap-3">
        <DivisionBadge division={row.divisionId} label={row.divisionName} height={26} />
        <span className="font-mono text-[11px] text-txt-3 tabular-nums whitespace-nowrap">
          <span className="text-txt">{row.registeredCount}</span> / {row.rosterCount} in
        </span>
      </div>

      {/* Registered share of the roster — the inverse of the list below, so a
          full bar and an empty list say the same thing. */}
      <div className="h-[3px] w-full bg-line/60 mb-3">
        <div className={['h-full', complete ? 'bg-gold' : 'bg-gold/70'].join(' ')} style={{ width: `${pct}%` }} />
      </div>

      {row.rosterCount === 0 ? (
        <p className="font-mono text-[12px] text-txt-3">No drivers graded yet.</p>
      ) : complete ? (
        <p className="font-mono text-[11px] tracking-[.15em] uppercase text-gold">Everyone&apos;s in</p>
      ) : (
        <>
          <p className="font-display font-bold text-[20px] text-txt leading-none mb-2">
            {missing}
            <span className="font-mono text-[11px] text-txt-3 ml-2 tracking-[.1em] uppercase">
              not registered
            </span>
          </p>
          <ul className="flex flex-col">
            {visible.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-2 py-1 border-b border-line/30 last:border-b-0 min-w-0"
              >
                <DriverTierBadge isSralien={d.isSralien} division={row.divisionId} tier={d.tier} />
                <span className="font-mono text-[13px] text-txt-2 truncate">
                  {d.displayName ?? 'Unnamed driver'}
                </span>
              </li>
            ))}
          </ul>
          {(hidden > 0 || expanded) && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="self-start mt-3 font-mono text-[11px] tracking-[.2em] uppercase text-gold hover:text-gold-soft transition-colors"
            >
              {expanded ? 'Show fewer' : `Show all ${missing}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
