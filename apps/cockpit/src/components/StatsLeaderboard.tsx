'use client';

import { useState } from 'react';
import type { LeaderboardCategory } from '../content/stats-leaderboards';

export function StatsLeaderboard({
  categories,
}: {
  categories: LeaderboardCategory[];
}) {
  const [activeTab, setActiveTab] = useState(0);
  const active = categories[activeTab];

  return (
    <div>
      <div className="flex flex-wrap justify-center gap-1 border-b border-line mb-4">
        {categories.map((cat, i) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => setActiveTab(i)}
            className={[
              'font-mono text-[11px] tracking-[.25em] uppercase px-4 py-2 -mb-px border-b-2 transition-colors cursor-pointer whitespace-nowrap',
              i === activeTab
                ? 'text-gold border-gold'
                : 'text-txt-3 border-transparent hover:text-txt-2',
            ].join(' ')}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="border border-line bg-panel overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-line">
              <th className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 px-6 py-4 w-16">
                Rank
              </th>
              <th className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 px-6 py-4">
                Driver
              </th>
              <th className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 px-6 py-4 text-right">
                {active.valueLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {active.entries.map((entry) => (
              <tr
                key={entry.rank}
                className={[
                  'border-b border-line/20',
                  entry.rank % 2 !== 0 ? 'bg-carbon-2' : '',
                ].join(' ')}
              >
                <td
                  className={[
                    'font-mono text-[14px] px-6 py-3',
                    entry.rank <= 3 ? 'text-gold' : 'text-txt-3',
                  ].join(' ')}
                >
                  {entry.rank}
                </td>
                <td className="font-display font-bold text-[14px] uppercase text-txt px-6 py-3">
                  {entry.name}
                </td>
                <td className="font-mono text-[12px] text-gold-soft text-right px-6 py-3">
                  {entry.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
