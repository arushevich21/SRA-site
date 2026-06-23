import type { SimGridChampionship } from '@sra/shared-types';

export function SectionLabel({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <p
      className={[
        'font-mono text-[11px] tracking-[.35em] uppercase mb-6',
        muted ? 'text-txt-3' : 'text-gold',
      ].join(' ')}
    >
      {children}
    </p>
  );
}

export function CategoryTag({
  label,
  muted = false,
}: {
  label: string;
  muted?: boolean;
}) {
  return (
    <span
      className={[
        'inline-block font-mono text-[10px] tracking-[.35em] uppercase px-2 py-[3px] border',
        muted ? 'text-txt-3 border-txt-3/30' : 'text-gold border-gold/40',
      ].join(' ')}
    >
      {label}
    </span>
  );
}

export function raceStatus(race: SimGridChampionship['races'][number]): {
  label: string;
  color: string;
} {
  if (race.ended && race.resultsAvailable) return { label: 'Results', color: 'text-gold' };
  if (race.ended) return { label: 'Pending', color: 'text-txt-3' };
  if (new Date(race.startsAt) > new Date()) return { label: 'Upcoming', color: 'text-live' };
  return { label: 'In Progress', color: 'text-live' };
}
