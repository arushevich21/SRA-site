'use client';

import { useState } from 'react';

// Side-by-side career comparison for the head-to-head page. "Totals" shows
// raw counts; "Rates" turns wins / podiums / top 10s into a share of starts,
// so a driver with fewer seasons isn't buried by volume. Starts, average
// finish and SRAting read the same in both modes.

export type TapeSide = {
  starts: number | null;
  wins: number | null;
  podiums: number | null;
  top10s: number | null;
  avgFinish: number | null;
  composite: number | null;
};

type Line = { label: string; a: number | null; b: number | null; fmt: (v: number) => string; higherWins: boolean };

const GOLD = 'var(--color-gold)';
const INK = 'var(--color-txt-2)';

function rate(n: number | null, starts: number | null): number | null {
  return n == null || !starts ? null : n / starts;
}

const count = (v: number) => String(v);
const percent = (v: number) => `${(v * 100).toFixed(1)}%`;

export function TaleOfTape({ a, b, aName, bName }: { a: TapeSide; b: TapeSide; aName: string; bName: string }) {
  const [mode, setMode] = useState<'totals' | 'rates'>('totals');
  const rates = mode === 'rates';

  const lines: Line[] = [
    rates
      ? { label: 'Win rate', a: rate(a.wins, a.starts), b: rate(b.wins, b.starts), fmt: percent, higherWins: true }
      : { label: 'Wins', a: a.wins, b: b.wins, fmt: count, higherWins: true },
    rates
      ? { label: 'Podium rate', a: rate(a.podiums, a.starts), b: rate(b.podiums, b.starts), fmt: percent, higherWins: true }
      : { label: 'Podiums', a: a.podiums, b: b.podiums, fmt: count, higherWins: true },
    rates
      ? { label: 'Top 10 rate', a: rate(a.top10s, a.starts), b: rate(b.top10s, b.starts), fmt: percent, higherWins: true }
      : { label: 'Top 10s', a: a.top10s, b: b.top10s, fmt: count, higherWins: true },
    { label: 'Starts', a: a.starts, b: b.starts, fmt: count, higherWins: true },
    { label: 'Avg finish', a: a.avgFinish, b: b.avgFinish, fmt: (v) => v.toFixed(1), higherWins: false },
    { label: 'SRAting', a: a.composite, b: b.composite, fmt: percent, higherWins: true },
  ];

  return (
    <div className="border border-line bg-panel px-7 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <p className="font-mono text-[11px] tracking-[.35em] uppercase text-gold">Tale of the Tape · GT3 Series</p>
        <div className="flex" role="group" aria-label="Show totals or rates">
          {(['totals', 'rates'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`font-mono text-[11px] tracking-[.15em] uppercase px-3.5 py-2 border cursor-pointer transition-colors ${
                mode === m ? 'bg-gold text-carbon border-gold font-bold' : 'border-line-2 text-txt-2 hover:text-txt'
              }`}
            >
              {m === 'totals' ? 'Totals' : 'Rates'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-x-3 pb-2 font-mono text-[10px] tracking-[.15em] uppercase text-txt-3">
        <span className="truncate">{aName}</span>
        <span />
        <span className="truncate text-right">{bName}</span>
      </div>

      {lines.map((l) => {
        const both = l.a != null && l.b != null;
        const aLeads = both && (l.higherWins ? l.a! > l.b! : l.a! < l.b!);
        const bLeads = both && (l.higherWins ? l.b! > l.a! : l.b! < l.a!);
        const max = both ? Math.max(l.a!, l.b!) : 0;
        const min = both ? Math.min(l.a!, l.b!) : 0;
        // Bar = share of the better value; for lower-is-better lines the
        // smaller value fills the bar.
        const share = (v: number | null) =>
          v == null || !both || max === 0 ? 0 : (l.higherWins ? v / max : min / v) * 100;
        return (
          <div
            key={l.label}
            className="grid grid-cols-[64px_minmax(0,1fr)_110px_minmax(0,1fr)_64px] items-center gap-3 py-3 border-t border-line"
          >
            <span className="font-display text-[22px] leading-none" style={{ color: aLeads ? GOLD : INK }}>
              {l.a == null ? '—' : l.fmt(l.a)}
            </span>
            <div className="h-1.5 bg-line flex justify-end">
              <div style={{ width: `${share(l.a)}%`, background: aLeads ? GOLD : INK }} />
            </div>
            <span className="font-mono text-[11px] tracking-[.12em] uppercase text-txt-3 text-center">{l.label}</span>
            <div className="h-1.5 bg-line">
              <div className="h-1.5" style={{ width: `${share(l.b)}%`, background: bLeads ? GOLD : INK }} />
            </div>
            <span className="font-display text-[22px] leading-none text-right" style={{ color: bLeads ? GOLD : INK }}>
              {l.b == null ? '—' : l.fmt(l.b)}
            </span>
          </div>
        );
      })}
      <p className="font-sans text-[13px] text-txt-3 mt-4">
        Gold marks who leads each line. {rates ? 'Rates are a share of GT3 Series starts.' : 'All-time GT3 Series record.'}
      </p>
    </div>
  );
}
