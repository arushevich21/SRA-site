'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { TakenEntry } from './NumberChecker';

// Browse the whole 2–999 pool a hundred at a time, free numbers first-class.
// Picking one links to /profile?number=N, which prefills the profile form's
// number field — a new driver can choose from what's actually free instead
// of guessing at the checker one number at a time.
export default function NumberBrowser({
  takenMap,
  min,
  max,
}: {
  takenMap: Record<number, TakenEntry>;
  min: number;
  max: number;
}) {
  // Hundreds blocks: 2–99, 100–199, …, 900–999.
  const blocks = useMemo(() => {
    const out: { start: number; end: number; free: number }[] = [];
    for (let start = Math.floor(min / 100) * 100; start <= max; start += 100) {
      const from = Math.max(start, min);
      const to = Math.min(start + 99, max);
      let free = 0;
      for (let n = from; n <= to; n++) if (!takenMap[n]) free++;
      out.push({ start: from, end: to, free });
    }
    return out;
  }, [takenMap, min, max]);

  const [blockIndex, setBlockIndex] = useState(0);
  const [showTaken, setShowTaken] = useState(false);
  const block = blocks[blockIndex];

  const numbers: number[] = [];
  for (let n = block.start; n <= block.end; n++) {
    if (showTaken || !takenMap[n]) numbers.push(n);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-4">
        {blocks.map((b, i) => (
          <button
            key={b.start}
            type="button"
            onClick={() => setBlockIndex(i)}
            aria-pressed={i === blockIndex}
            className={[
              'font-mono text-[11px] tracking-[.15em] px-3 py-1.5 border transition-colors',
              i === blockIndex
                ? 'text-gold border-gold bg-gold/5'
                : 'text-txt-3 border-line hover:text-txt-2',
            ].join(' ')}
          >
            {b.start}–{b.end}
            <span className="ml-2 opacity-60">{b.free} free</span>
          </button>
        ))}
      </div>

      <label className="inline-flex items-center gap-2 mb-5 font-mono text-[11px] tracking-[.15em] uppercase text-txt-3 cursor-pointer">
        <input
          type="checkbox"
          checked={showTaken}
          onChange={(e) => setShowTaken(e.target.checked)}
          className="accent-gold w-4 h-4"
        />
        Show taken numbers too
      </label>

      {numbers.length === 0 ? (
        <p className="font-sans text-[14px] text-txt-3">Every number in this range is taken.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-1.5">
          {numbers.map((n) => {
            const taken = takenMap[n];
            if (taken) {
              return (
                <span
                  key={n}
                  title={`Taken by ${taken.name}`}
                  className="border border-line/40 px-2 py-2 text-center font-mono text-[13px] tabular-nums text-txt-3/40 line-through cursor-default"
                >
                  {n}
                </span>
              );
            }
            return (
              <Link
                key={n}
                href={`/profile?number=${n}`}
                title={`#${n} is free — use it on your profile`}
                className="border border-line bg-panel px-2 py-2 text-center font-mono text-[13px] tabular-nums text-txt hover:border-gold hover:text-gold transition-colors"
              >
                {n}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
