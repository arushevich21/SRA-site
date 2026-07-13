'use client';

import { useEffect, useRef, useState } from 'react';

export type Stat = { value: string; label: string };

const DURATION_MS = 1800;

function parseStat(value: string): { target: number; suffix: string } {
  const suffix = value.match(/[^\d,]+$/)?.[0] ?? '';
  const target = Number(value.replace(/[^\d]/g, '')) || 0;
  return { target, suffix };
}

function useCountUp(target: number): number {
  const [current, setCurrent] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    let frame: number;
    function tick(timestamp: number) {
      if (startRef.current == null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / DURATION_MS, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(target * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return current;
}

function StatItem({ stat }: { stat: Stat }) {
  const { target, suffix } = parseStat(stat.value);
  const current = useCountUp(target);

  return (
    <span className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-2">
      <span className="text-gold font-bold tabular-nums">
        {Math.round(current).toLocaleString('en-US')}
        {suffix}
      </span>{' '}
      {stat.label}
    </span>
  );
}

// Split into rows of 3 so a non-multiple-of-3 tail (e.g. 5 stats) still
// centers as its own row instead of grid-aligning under the row above.
export function CountUpStats({ stats }: { stats: Stat[] }) {
  const rows: Stat[][] = [];
  for (let i = 0; i < stats.length; i += 3) rows.push(stats.slice(i, i + 3));

  return (
    <div className="mt-12 flex flex-col items-center gap-3">
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap justify-center gap-x-4 gap-y-3 sm:gap-x-8">
          {row.map((stat) => (
            <StatItem key={stat.label} stat={stat} />
          ))}
        </div>
      ))}
    </div>
  );
}
