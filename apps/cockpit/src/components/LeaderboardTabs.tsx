'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Board tabs for ACC leaderboards, in nav order:
//   • Hot Lap                    — always-on per-track single-lap board
//   • Hot Lap (Seasonal)         — per-season single-lap boards (season dropdown)
//   • Hot Stint                  — always-on per-track best 5-lap-average board
//   • Hot Stint (Seasonal)       — per-season stint boards (season dropdown)
//   • Hot Lap (Endurance)        — endurance pre-qual board (only once an
//                                  endurance championship releases a round)
//   • Hot Stint Qualifying       — pre-season classification board, sourced
//                                  from classification_status_public (an
//                                  external bot's data, not this app's own
//                                  ingest — see lib/acc/hot-stint-store.ts).
//                                  Shown only while a classification run is
//                                  in progress (showHotStintQualifying).
//   • #Jagoff                    — in-house side competition, fastest
//                                  qualifying-window stint in the Jaguar G3
//                                  only (see getJagoffBoard in
//                                  lib/acc/hot-stint-store.ts). Shown only
//                                  once someone has actually set a Jaguar
//                                  time this season (showJagoff), unlike
//                                  Hot Stint Qualifying which shows empty.
// Hot Lap and Hot Stint are always on; the two Seasonal tabs show whenever
// seasonal data exists (showSeasonal); Endurance is release-gated.
export function LeaderboardTabs({
  simSlug,
  showSeasonal = false,
  showEndurance = false,
  showHotStintQualifying = false,
  showJagoff = false,
}: {
  simSlug: string;
  showSeasonal?: boolean;
  showEndurance?: boolean;
  showHotStintQualifying?: boolean;
  showJagoff?: boolean;
}) {
  const pathname = usePathname();
  const onStintSeasonal = pathname.includes('/leaderboards/hotstint/seasonal');
  const onStint = pathname.includes('/leaderboards/hotstint') && !onStintSeasonal;
  const onHotlapSeasonal = pathname.includes('/leaderboards/seasonal');
  const onEndurance = pathname.includes('/leaderboards/endurance');
  const onHotStintQualifying = pathname.includes('/leaderboards/hotstint-qualifying');
  const onJagoff = pathname.includes('/leaderboards/jagoff');
  const onSweatshop = pathname.includes('/leaderboards/sweatshop');
  const onHotLap =
    !onStint &&
    !onStintSeasonal &&
    !onHotlapSeasonal &&
    !onEndurance &&
    !onHotStintQualifying &&
    !onJagoff &&
    !onSweatshop;

  const tabs = [
    { label: 'Hot Lap', href: `/${simSlug}/leaderboards`, active: onHotLap, show: true },
    { label: 'Hot Lap (Seasonal)', href: `/${simSlug}/leaderboards/seasonal`, active: onHotlapSeasonal, show: showSeasonal },
    { label: 'Hot Stint', href: `/${simSlug}/leaderboards/hotstint`, active: onStint, show: true },
    { label: 'Hot Stint (Seasonal)', href: `/${simSlug}/leaderboards/hotstint/seasonal`, active: onStintSeasonal, show: showSeasonal },
    { label: 'Hot Lap (Endurance)', href: `/${simSlug}/leaderboards/endurance`, active: onEndurance, show: showEndurance },
    { label: 'Hot Stint Qualifying', href: `/${simSlug}/leaderboards/hotstint-qualifying`, active: onHotStintQualifying, show: showHotStintQualifying },
    { label: '#Jagoff', href: `/${simSlug}/leaderboards/jagoff`, active: onJagoff, show: showJagoff },
    { label: 'Sweatshop 💦', href: `/${simSlug}/leaderboards/sweatshop`, active: onSweatshop, show: true },
  ].filter((t) => t.show);

  // The baseline is an inset shadow, not a border the tabs overlap with
  // -mb-px: that 1px overhang overflows the box, and overflow-x-auto makes the
  // y axis scrollable too, so it showed a stray vertical scrollbar.
  return (
    <div className="flex mb-10 -mt-6 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--color-line)]">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={[
            'font-mono text-[11px] tracking-[.2em] uppercase px-5 py-3 border-b-2 whitespace-nowrap transition-colors',
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
