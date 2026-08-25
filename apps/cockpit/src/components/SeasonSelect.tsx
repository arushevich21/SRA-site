'use client';

import { useRouter } from 'next/navigation';

// Season picker for the seasonal leaderboards. Navigates to `${basePath}/${season}`
// on change — season is a path segment (not ?season=) so the target page can
// be ISR'd; searchParams would force it dynamic. Styled to match
// HotLapBoard's class-filter <select>.
export function SeasonSelect({
  seasons,
  selected,
  basePath,
}: {
  seasons: string[];
  selected: string;
  basePath: string;
}) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-3">
      <span className="font-mono text-[12px] tracking-[.2em] uppercase text-txt-3">Season</span>
      <select
        value={selected}
        onChange={(e) => router.push(`${basePath}/${e.target.value}`)}
        className="font-mono text-[13px] tracking-[.15em] uppercase px-3 py-1.5 border border-line/50 bg-carbon text-txt hover:border-line transition-colors cursor-pointer"
      >
        {seasons.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </label>
  );
}
