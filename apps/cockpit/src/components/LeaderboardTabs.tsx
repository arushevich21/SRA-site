'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Hot-lap board tabs for ACC leaderboards:
//   • Hot Lap            — the always-on per-track community board
//   • Hot Lap (Seasonal) — admin-released, Team-Series event-tied board (only
//                          shown once such a championship releases a round)
//   • Hot Lap (Endurance)— endurance pre-qual board (only shown once an
//                          endurance championship releases a round)
// Seasonal and Endurance both hide until their type has a released round.
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
  const onEndurance = pathname.endsWith('/leaderboards/endurance');
  const onSeasonal = pathname.endsWith('/leaderboards/seasonal');

  const tabs = [
    { label: 'Hot Lap', href: `/${simSlug}/leaderboards`, active: !onEndurance && !onSeasonal, show: true },
    { label: 'Hot Lap (Seasonal)', href: `/${simSlug}/leaderboards/seasonal`, active: onSeasonal, show: showSeasonal },
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
