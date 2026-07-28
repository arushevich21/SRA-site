'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Board tabs for ACC leaderboards, in nav order:
//   • Hot Lap            — always-on per-track single-lap board
//   • Hot Lap (Seasonal) — per-season single-lap boards (season dropdown)
//   • Hot Stint          — always-on per-track best 5-lap-average board
//   • Hot Stint (Seasonal)— per-season stint boards (season dropdown)
//   • Hot Lap (Endurance)— endurance pre-qual board (only once an endurance
//                          championship releases a round)
// Hot Lap and Hot Stint are always on; the two Seasonal tabs show whenever
// seasonal data exists (showSeasonal); Endurance is release-gated.
export function LeaderboardTabs({
  simSlug,
  showSeasonal = false,
  showEndurance = false,
}: {
  simSlug: string;
  showSeasonal?: boolean;
  showEndurance?: boolean;
}) {
  const pathname = usePathname();
  const onStintSeasonal = pathname.includes('/leaderboards/hotstint/seasonal');
  const onStint = pathname.includes('/leaderboards/hotstint') && !onStintSeasonal;
  const onHotlapSeasonal = pathname.includes('/leaderboards/seasonal');
  const onEndurance = pathname.includes('/leaderboards/endurance');
  const onHotLap = !onStint && !onStintSeasonal && !onHotlapSeasonal && !onEndurance;

  const tabs = [
    { label: 'Hot Lap', href: `/${simSlug}/leaderboards`, active: onHotLap, show: true },
    { label: 'Hot Lap (Seasonal)', href: `/${simSlug}/leaderboards/seasonal`, active: onHotlapSeasonal, show: showSeasonal },
    { label: 'Hot Stint', href: `/${simSlug}/leaderboards/hotstint`, active: onStint, show: true },
    { label: 'Hot Stint (Seasonal)', href: `/${simSlug}/leaderboards/hotstint/seasonal`, active: onStintSeasonal, show: showSeasonal },
    { label: 'Hot Lap (Endurance)', href: `/${simSlug}/leaderboards/endurance`, active: onEndurance, show: showEndurance },
  ].filter((t) => t.show);

  return (
    <div className="flex border-b border-line mb-10 -mt-6">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={[
            'font-mono text-[11px] tracking-[.2em] uppercase px-5 py-3 border-b-2 -mb-px transition-colors',
            t.active
              ? 'border-gold text-gold'
              : 'border-transparent text-txt-3 hover:text-txt',
          ].join(' ')}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
