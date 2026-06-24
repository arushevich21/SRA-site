'use client';

import { useState } from 'react';
import type { ExportedClassGroup } from '../lib/standings-types';
import { ClassGroupTable } from './ClassGroupTable';

export function ClassStandingsTabs({
  groups,
}: {
  groups: ExportedClassGroup[];
}) {
  const [activeTab, setActiveTab] = useState(0);

  if (groups.length === 1) {
    return <ClassGroupTable group={groups[0]} />;
  }

  return (
    <div>
      <div className="flex gap-1 border-b border-line mb-4">
        {groups.map((g, i) => (
          <button
            key={g.carClass}
            type="button"
            onClick={() => setActiveTab(i)}
            className={[
              'font-mono text-[11px] tracking-[.25em] uppercase px-4 py-2 -mb-px border-b-2 transition-colors cursor-pointer',
              i === activeTab
                ? 'text-gold border-gold'
                : 'text-txt-3 border-transparent hover:text-txt-2',
            ].join(' ')}
          >
            {g.carClass}
          </button>
        ))}
      </div>
      <ClassGroupTable group={groups[activeTab]} />
    </div>
  );
}
