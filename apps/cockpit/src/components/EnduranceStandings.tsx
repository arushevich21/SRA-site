'use client';

import { useState } from 'react';
import type { StandingsExport } from '../lib/standings-types';
import { ClassGroupTable } from './ClassGroupTable';

type ClassFilter = 'overall' | 'open' | 'silver' | 'bronze';

const FILTERS: { key: ClassFilter; label: string; plateColor: string }[] = [
  { key: 'overall', label: 'Overall', plateColor: '' },
  { key: 'open', label: 'Open', plateColor: 'bg-white' },
  { key: 'silver', label: 'Silver', plateColor: 'bg-[#8a8a8a]' },
  { key: 'bronze', label: 'Bronze', plateColor: 'bg-[#c0392b]' },
];

export function EnduranceStandings({
  standings,
}: {
  standings: StandingsExport;
}) {
  const [filter, setFilter] = useState<ClassFilter>('overall');

  const openGroup = standings.find((g) =>
    g.carClass.toLowerCase().includes('open'),
  );
  const silverGroup = standings.find((g) =>
    g.carClass.toLowerCase().includes('silver'),
  );
  const bronzeGroup = standings.find((g) =>
    g.carClass.toLowerCase().includes('bronze'),
  );

  return (
    <div>
      {/* Class filter */}
      <div className="flex gap-1 mb-6 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={[
              'font-mono text-[11px] tracking-[.2em] uppercase px-3 py-1.5 border transition-colors cursor-pointer flex items-center gap-2',
              f.key === filter
                ? 'text-gold border-gold bg-gold/5'
                : 'text-txt-3 border-line hover:text-txt-2',
            ].join(' ')}
          >
            {f.plateColor && (
              <span
                className={`inline-block w-3 h-2 rounded-[1px] ${f.plateColor}`}
              />
            )}
            {f.label}
          </button>
        ))}
      </div>

      {/* Standings */}
      {standings.length === 0 ? (
        <div className="border border-gold-deep/30 bg-gold-deep/5 px-5 py-4">
          <p className="font-mono text-[11px] tracking-[.15em] uppercase text-gold-deep">
            No standings data yet
          </p>
          <p className="font-sans text-[12px] text-txt-3 mt-1">
            Standings will be available after Round 1 results are published.
          </p>
        </div>
      ) : filter === 'overall' ? (
        <div className="flex flex-col gap-8">
          {standings.map((group) => (
            <ClassGroupTable key={group.carClass} group={group} />
          ))}
        </div>
      ) : filter === 'open' && openGroup ? (
        <ClassGroupTable group={openGroup} />
      ) : filter === 'silver' && silverGroup ? (
        <ClassGroupTable group={silverGroup} />
      ) : filter === 'bronze' && bronzeGroup ? (
        <ClassGroupTable group={bronzeGroup} />
      ) : (
        <div className="border border-gold-deep/30 bg-gold-deep/5 px-5 py-4">
          <p className="font-mono text-[11px] tracking-[.15em] uppercase text-gold-deep">
            No data for this class
          </p>
        </div>
      )}
    </div>
  );
}
