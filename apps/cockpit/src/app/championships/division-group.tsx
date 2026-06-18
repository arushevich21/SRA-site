'use client';

import { useState } from 'react';

type PastSeason = {
  division: number;
  season: number;
  championDriver: string;
  championTeam: string | null;
  championPoints: string;
};

export function DivisionGroup({
  division,
  seasons,
}: {
  division: number;
  seasons: PastSeason[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-8">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="font-mono text-[10px] tracking-[.35em] uppercase text-txt-3 mb-3 flex items-center gap-3 cursor-pointer group w-full text-left"
      >
        <span className="h-px w-4 bg-line" />
        Division {division}
        <span className="text-txt-3/50 text-[9px] ml-1">
          {seasons.length} seasons
        </span>
        <span
          className={[
            'ml-auto text-[9px] text-txt-3/50 transition-transform duration-200 group-hover:text-gold',
            open ? 'rotate-90' : '',
          ].join(' ')}
        >
          ▶
        </span>
      </button>

      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {seasons.map((s) => (
            <div
              key={`d${s.division}-s${s.season}`}
              className="border border-line/30 bg-carbon-2 px-4 py-3"
            >
              <div className="flex items-baseline justify-between mb-1">
                <span className="font-mono text-[11px] tracking-[.2em] text-gold">
                  S{s.season}
                </span>
                <span className="font-mono text-[11px] tracking-[.1em] text-gold-soft">
                  {s.championPoints} pts
                </span>
              </div>
              <p className="font-display font-bold text-[14px] uppercase leading-tight text-txt truncate">
                {s.championDriver}
              </p>
              {s.championTeam && (
                <p className="font-sans text-[12px] text-txt-3 truncate mt-0.5">
                  {s.championTeam}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
