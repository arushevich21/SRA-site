'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { LeaderboardCategory, LeaderboardIcon } from '@/lib/site-stats';
import { countryFlagUrl } from '@/lib/country-flag';
import { CarLogo } from './CarLogo';

// Flag (track) or manufacturer badge (car) in a fixed-width slot, so names
// line up even on rows where a track has no country or a car no badge.
function EntryIcon({ icon }: { icon: LeaderboardIcon }) {
  return (
    <span className="w-6 flex items-center justify-center shrink-0">
      {icon.kind === 'flag' ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny CDN flag, same as HotLapBoard
        <img
          src={countryFlagUrl(icon.country)}
          alt={icon.country.toUpperCase()}
          width={20}
          height={14}
          className="w-5 h-[14px] object-cover"
          decoding="async"
        />
      ) : (
        <CarLogo manufacturerIconName={icon.manufacturerIconName} manufacturerLogoUrl={icon.manufacturerLogoUrl} alt="" size={20} />
      )}
    </span>
  );
}

export function StatsLeaderboard({
  categories,
}: {
  categories: LeaderboardCategory[];
}) {
  const [activeTab, setActiveTab] = useState(0);
  const active = categories[activeTab];
  if (!active) return null;

  return (
    // Capped width: on a full 1280px row the name and its number sit too far
    // apart to read across.
    <div className="max-w-[880px] mx-auto">
      <div className="flex flex-wrap justify-center gap-1 border-b border-line mb-4">
        {categories.map((cat, i) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => setActiveTab(i)}
            aria-pressed={i === activeTab}
            className={[
              'font-mono text-[11px] tracking-[.25em] uppercase px-4 py-2 -mb-px border-b-2 transition-colors cursor-pointer whitespace-nowrap focus-visible:outline focus-visible:outline-1 focus-visible:outline-gold',
              i === activeTab ? 'text-gold border-gold' : 'text-txt-3 border-transparent hover:text-txt-2',
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
              <th className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 pl-6 pr-2 py-4 w-20">Rank</th>
              <th className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 px-4 py-4">
                {active.subjectLabel}
              </th>
              <th className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 px-6 py-4 text-right">
                {active.valueLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Index keys: tied drivers share a rank. The podium (ranks 1-3)
                is the one emphasised band: bigger name, gold rule and value. */}
            {active.entries.map((entry, i) => {
              const podium = entry.rank <= 3;
              return (
                <tr
                  key={`${active.key}-${i}`}
                  className={[
                    'border-t border-line/40 first:border-t-0',
                    podium ? 'bg-carbon-2 shadow-[inset_2px_0_0_var(--color-gold)]' : '',
                  ].join(' ')}
                >
                  <td
                    className={
                      podium
                        ? 'font-display font-black text-[22px] leading-none text-gold pl-6 pr-2 py-4'
                        : 'font-mono text-[13px] text-txt-3 pl-6 pr-2 py-3 tabular-nums'
                    }
                  >
                    {entry.rank}
                  </td>
                  <td
                    className={[
                      'font-display font-bold uppercase text-txt px-4',
                      podium ? 'text-[18px] py-4' : 'text-[15px] py-3',
                    ].join(' ')}
                  >
                    <span className="flex items-center gap-3">
                      {entry.icon && <EntryIcon icon={entry.icon} />}
                      {entry.href ? (
                        <Link href={entry.href} className="hover:text-gold transition-colors">
                          {entry.name}
                        </Link>
                      ) : (
                        <span>{entry.name}</span>
                      )}
                    </span>
                  </td>
                  <td
                    className={[
                      'font-mono text-right px-6 tabular-nums',
                      podium ? 'text-[15px] text-gold' : 'text-[14px] text-txt-2',
                    ].join(' ')}
                  >
                    {entry.value}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
