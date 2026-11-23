'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { WrappedStory } from '@/components/wrapped/WrappedStory';
import type { WrappedDriverCard, WrappedRosterEntry } from '@/lib/wrapped/card';

// Admin preview: any S19 driver's Wrapped, built live (before the snapshot
// exists, or to check a change). Drivers see theirs at /wrapped/s19.
export function WrappedPrototype({ card, roster }: { card: WrappedDriverCard; roster: WrappedRosterEntry[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const divisions = [...new Set(roster.map((r) => r.division))];

  const pickDriver = (steamId: string) => {
    const q = new URLSearchParams(params.toString());
    q.set('d', steamId);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-10 items-start">
      <aside className="w-full lg:w-[280px] shrink-0 flex flex-col gap-5">
        <div>
          <label htmlFor="wr-driver" className="block font-sans text-[13px] font-semibold text-txt-2 mb-2">
            Preview as
          </label>
          <select
            id="wr-driver"
            value={card.steamId}
            onChange={(e) => pickDriver(e.target.value)}
            className="w-full bg-panel-2 text-txt border border-line px-3 py-2.5 font-sans text-[14px] focus:outline-none focus:border-gold"
          >
            {divisions.map((div) => (
              <optgroup key={div} label={`Division ${div}`}>
                {roster
                  .filter((r) => r.division === div)
                  .map((r) => (
                    <option key={r.steamId} value={r.steamId}>
                      {r.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>
        <p className="font-sans text-[13px] text-txt-3 leading-relaxed">
          Tap the right of the story to skip ahead, the left to go back. Hold to pause, or press space. Admins
          only; built live from Season 19 data.
        </p>
      </aside>
      <div className="w-full">
        <WrappedStory key={card.steamId} card={card} />
      </div>
    </div>
  );
}
