import Link from 'next/link';
import { type ChampionshipContent } from '@/content/championships';
import { formatScheduleDateTime } from '@/lib/schedule-format';
import { CalendarGrid, type CalendarGridEvent } from './CalendarGrid';
import { LocalScheduleDate, LocalScheduleTime } from './LocalScheduleDateTime';

export function ChampionshipCalendarBody({
  champ,
  simSlug,
  accentColor,
  roundsWithResults,
}: {
  champ: ChampionshipContent;
  simSlug: string;
  accentColor: string;
  // See RealChampionshipBlock's own prop of the same name — the ACC
  // equivalent of a round having emperorRawTrackName set for AC Evo.
  roundsWithResults?: Set<number>;
}) {
  if (champ.teaserOnly || champ.schedule.length === 0) {
    return (
      <div className="border border-line/50 bg-carbon-2 px-8 py-12 text-center">
        <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3">
          No scheduled events yet — coming soon
        </p>
      </div>
    );
  }

  const champHref = `/${simSlug}/championships/${champ.slug}`;
  // A round with a matched results event links straight there; otherwise
  // falls back to the championship page, same as before.
  const hasResults = (round: ChampionshipContent['schedule'][number]) =>
    Boolean(round.emperorRawTrackName) || (roundsWithResults?.has(round.round) ?? false);
  const resultsHref = (round: ChampionshipContent['schedule'][number]) =>
    hasResults(round) ? `${champHref}/results/${round.round}` : champHref;

  const gridEvents: CalendarGridEvent[] = champ.schedule
    .filter((round) => round.date)
    .map((round) => ({
      iso: round.date!,
      title: `R${round.round} · ${round.track}`,
      href: resultsHref(round),
      color: accentColor,
    }));

  return (
    <div>
      {gridEvents.length > 0 && <CalendarGrid events={gridEvents} />}

      <div className="mb-5 space-y-1">
        {champ.raceDays && (
          <p className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-2">
            {champ.raceDays}
          </p>
        )}
        <p className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3">
          {champ.raceFormat}
        </p>
      </div>

      <div className="border border-line bg-panel">
        {champ.schedule.map((round, i) => {
          const { time: timeStr } = formatScheduleDateTime(round.date);
          const rowClassName = [
            'flex items-center gap-5 px-6 py-[11px]',
            i < champ.schedule.length - 1 ? 'border-b border-line/50' : '',
            hasResults(round) ? 'hover:bg-panel-2 transition-colors' : '',
          ].join(' ');
          const rowContent = (
            <>
              <span className="font-mono text-[15px] tracking-[.2em] uppercase text-gold w-10 shrink-0">
                R{round.round}
              </span>
              <span className="font-display font-bold text-[20px] uppercase leading-none text-txt-2 flex-1 min-w-0 truncate">
                {round.track}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="font-display font-bold text-[20px] uppercase leading-none text-txt">
                  <LocalScheduleDate iso={round.date} />
                </span>
                {timeStr && (
                  <>
                    <span className="text-txt-3">·</span>
                    <span className="font-mono text-[15px] tracking-[.1em] text-txt-2">
                      <LocalScheduleTime iso={round.date} />
                    </span>
                  </>
                )}
              </span>
              <span className="font-mono text-[15px] tracking-[.1em] uppercase text-txt-3/70 shrink-0 w-24 text-right">
                {round.raceLength}
              </span>
            </>
          );

          // Only rounds with a matched results event are links — others stay
          // plain, non-interactive rows (same rule as RealChampionshipBlock's
          // schedule rows).
          return hasResults(round) ? (
            <Link key={round.round} href={resultsHref(round)} className={rowClassName}>
              {rowContent}
            </Link>
          ) : (
            <div key={round.round} className={rowClassName}>
              {rowContent}
            </div>
          );
        })}
      </div>
    </div>
  );
}
