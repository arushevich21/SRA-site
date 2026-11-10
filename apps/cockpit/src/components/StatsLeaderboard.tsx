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
                {active.subjectLabel}
              </th>
              <th className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 px-6 py-4 text-right">
                {active.valueLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Index keys: tied drivers share a rank. */}
            {active.entries.map((entry, i) => (
              <tr
                key={`${active.key}-${i}`}
                className={['border-b border-line/20', i % 2 === 0 ? 'bg-carbon-2' : ''].join(' ')}
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
