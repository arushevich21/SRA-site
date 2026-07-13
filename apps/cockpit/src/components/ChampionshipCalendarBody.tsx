import { type ChampionshipContent, formatScheduleDateTime } from '@/content/championships';
import { CalendarGrid, type CalendarGridEvent } from './CalendarGrid';
import { LocalScheduleDate, LocalScheduleTime } from './LocalScheduleDateTime';

export function ChampionshipCalendarBody({
  champ,
  simSlug,
  accentColor,
}: {
  champ: ChampionshipContent;
  simSlug: string;
  accentColor: string;
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

  const gridEvents: CalendarGridEvent[] = champ.schedule
    .filter((round) => round.date)
    .map((round) => ({
      date: new Date(round.date!),
      hasTime: round.date!.includes('T'),
      title: `R${round.round} · ${round.track}`,
      href: `/${simSlug}/championships/${champ.slug}`,
      color: accentColor,
    }));

  return (
    <div>
      {gridEvents.length > 0 && <CalendarGrid events={gridEvents} />}

      <p className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 mb-5">
        {champ.raceFormat}
      </p>

      <div className="border border-line bg-panel">
        {champ.schedule.map((round, i) => {
          const { date: dateStr, time: timeStr } = formatScheduleDateTime(round.date);
          return (
            <div
              key={round.round}
              className={[
                'flex items-center gap-5 px-6 py-[11px]',
                i < champ.schedule.length - 1 ? 'border-b border-line/50' : '',
              ].join(' ')}
            >
              <span className="font-mono text-[15px] tracking-[.2em] uppercase text-gold w-10 shrink-0">
                R{round.round}
              </span>
              <span className="font-display font-bold text-[20px] uppercase leading-none text-txt-2 flex-1 min-w-0 truncate">
                {round.track}
              </span>
              <span className="flex flex-col items-end shrink-0 leading-tight">
                <span className="font-display font-bold text-[14px] uppercase text-txt">
                  <LocalScheduleDate iso={round.date} initial={dateStr} />
                </span>
                {timeStr && (
                  <span className="font-mono text-[12px] tracking-[.1em] text-txt-2">
                    <LocalScheduleTime iso={round.date} initial={timeStr} />
                  </span>
                )}
              </span>
              <span className="font-mono text-[10px] tracking-[.15em] uppercase text-txt-3/70 shrink-0 w-16 text-right">
                {round.raceLength}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
