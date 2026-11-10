'use client';

import { useState } from 'react';
import type { RatingPoint } from '@/lib/driver-stats';

// SRAting composite over a driver's recent race weeks — one series, so no
// legend (the block title names it). Thin 2px line, a marker on the latest
// value, recessive frame, and a hover crosshair + tooltip; the hit target is
// the whole column, not the line. The y-range is fitted to the data (a 0-100%
// axis would flatten every top driver's line to the ceiling) and its bounds
// are labeled so the fit is never mistaken for the full scale.

const W = 280;
const H = 72;
const PAD_X = 6;
const PAD_Y = 8;

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

export function SRatingTrend({ points }: { points: RatingPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;

  const values = points.map((p) => p.composite);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (hi - lo < 0.01) {
    lo = Math.max(0, lo - 0.005);
    hi = Math.min(1, hi + 0.005);
  }
  const x = (i: number) => PAD_X + (i * (W - 2 * PAD_X)) / (points.length - 1);
  const y = (v: number) => PAD_Y + (1 - (v - lo) / (hi - lo)) * (H - 2 * PAD_Y);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.composite).toFixed(1)}`).join(' ');
  const last = points.length - 1;
  const shown = hover ?? last;

  return (
    <figure className="m-0">
      <div className="flex items-baseline justify-between font-mono text-[11px] uppercase text-txt-3 mb-1">
        <span>Last {points.length} race weeks</span>
        <span className="text-txt-2 normal-case">
          {points[shown].label} · {pct(points[shown].composite)}
        </span>
      </div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto block"
          role="img"
          aria-label={`SRAting trend from ${pct(values[0])} to ${pct(values[last])} over ${points.length} race weeks`}
          onMouseLeave={() => setHover(null)}
        >
          <line x1={PAD_X} x2={W - PAD_X} y1={H - PAD_Y} y2={H - PAD_Y} stroke="var(--color-line)" strokeWidth={1} />
          <path d={d} fill="none" stroke="var(--color-gold)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {hover != null && (
            <line x1={x(hover)} x2={x(hover)} y1={PAD_Y / 2} y2={H - PAD_Y} stroke="var(--color-line-2)" strokeWidth={1} />
          )}
          <circle
            cx={x(shown)}
            cy={y(points[shown].composite)}
            r={4}
            fill="var(--color-gold)"
            stroke="var(--color-panel)"
            strokeWidth={2}
          />
          {points.map((p, i) => (
            <rect
              key={p.label}
              x={x(i) - (W - 2 * PAD_X) / (points.length - 1) / 2}
              y={0}
              width={(W - 2 * PAD_X) / (points.length - 1)}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            >
              <title>{`${p.label}: ${pct(p.composite)}`}</title>
            </rect>
          ))}
        </svg>
      </div>
      <figcaption className="flex justify-between font-mono text-[10px] text-txt-3 mt-1">
        <span>range {pct(lo)} – {pct(hi)}</span>
        <span>{points[0].label} → {points[last].label}</span>
      </figcaption>
    </figure>
  );
}
