import { Fragment } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatScheduleDateTime } from '@/lib/schedule-format';
import { getChampionships } from '@/lib/championships-store';
import { SIMS } from '@/content/sims';
import { CalendarGrid, type CalendarGridEvent } from '@/components/CalendarGrid';
import { GameLabel } from '@/components/GameLabel';
import { LocalScheduleDate, LocalScheduleTime } from '@/components/LocalScheduleDateTime';
import { getCalendarEvents } from '@/lib/calendar-events-store';
import { getAccRaceEvents, matchAccRoundsToResultEventsFrom } from '@/lib/acc/race-results-store';
import type { ChampionshipContent } from '@/content/championships';

export default async function CalendarPage() {
  const [championships, calendarEvents] = await Promise.all([
    getChampionships(),
    getCalendarEvents(),
  ]);
  const teasedChamps = championships.filter((c) => c.teaserOnly);
  const realChamps = championships.filter((c) => c.schedule.length > 0 && !c.teaserOnly);

  // One acc_race_sessions fetch shared across every real ACC championship on
  // this page (spans all sims) — see matchAccRoundsToResultEventsFrom.
  const accChamps = realChamps.filter((c) => c.game !== 'AC Evo');
  const accEvents = accChamps.length > 0 ? await getAccRaceEvents() : [];
  const roundsWithResultsByChamp = new Map<string, Set<number>>(
    accChamps.map((c) => [
      c.slug,
      new Set(
        matchAccRoundsToResultEventsFrom(accEvents, c.schedule, c.emperorChampionshipId ?? null).keys(),
      ),
    ]),
  );
  const hasResults = (champ: ChampionshipContent, round: ChampionshipContent['schedule'][number]) =>
    Boolean(round.emperorRawTrackName) || (roundsWithResultsByChamp.get(champ.slug)?.has(round.round) ?? false);
  const resultsHref = (
    champ: ChampionshipContent,
    round: ChampionshipContent['schedule'][number],
    sim: (typeof SIMS)[number] | undefined,
  ) => {
    if (!sim) return '/calendar';
    const champHref = `/${sim.slug}/championships/${champ.slug}`;
    return hasResults(champ, round) ? `${champHref}/results/${round.round}` : champHref;
  };

  const gridEvents: CalendarGridEvent[] = realChamps.flatMap((champ) => {
    const sim = SIMS.find((s) => s.game === champ.game);
    return champ.schedule
      .filter((round) => round.date)
      .map((round) => ({
        iso: round.date!,
        title: `${champ.game} · R${round.round} · ${round.track}`,
        href: resultsHref(champ, round, sim),
        color: sim?.accentColor,
      }));
  });

  // Admin-managed, non-race entries (deadlines, streams, announcements) —
  // every calendar_events row shows on the cumulative calendar regardless of
  // its `game`; /[sim]/calendar filters to that sim's own events only.
  for (const e of calendarEvents) {
    const sim = e.game ? SIMS.find((s) => s.game === e.game) : undefined;
    gridEvents.push({
      iso: e.eventDate,
      title: e.title,
      href: e.href ?? '/calendar',
      color: e.color ?? sim?.accentColor,
    });
  }

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">
        — Calendar
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-16">
        Race Calendar
      </h1>

      {gridEvents.length > 0 && <CalendarGrid events={gridEvents} />}

      {teasedChamps.length === 0 && realChamps.length === 0 && (
        <div className="border border-line/50 bg-carbon-2 px-8 py-12 text-center">
          <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3">
            No scheduled events yet — coming soon
          </p>
        </div>
      )}

      {teasedChamps.length > 0 && (
        <div className="mb-16">
          {teasedChamps.map((champ, i) => (
            <Fragment key={champ.standingsKey ?? champ.simgridId ?? champ.title}>
              {i > 0 && <div className="h-px bg-line my-10" />}
              <div className="flex items-center gap-4">
                {champ.logo && (
                  <Image
                    src={champ.logo}
                    alt={champ.title}
                    width={96}
                    height={96}
                    className="w-[80px] h-[80px] shrink-0 object-contain opacity-70"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-2">
                    <h2 className="font-display font-bold text-[20px] uppercase leading-none text-txt/70 text-balance">
                      {champ.title}
                    </h2>
                    <span className="inline-block font-mono text-[11px] tracking-[.35em] uppercase px-2 py-[3px] border text-txt-3/60 border-txt-3/20 whitespace-nowrap">
                      {champ.classTag}
                    </span>
                  </div>
                  <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3">
                    Coming Soon
                  </p>
                </div>
              </div>
            </Fragment>
          ))}
        </div>
      )}

      {realChamps.map((champ) => {
        const sim = SIMS.find((s) => s.game === champ.game);
        return (
        <div key={champ.standingsKey ?? champ.simgridId ?? champ.title} className="mb-14">
          <div className="flex items-center gap-4 mb-6">
            {champ.logo && (
              <Image
                src={champ.logo}
                alt={champ.title}
                width={96}
                height={96}
                className="w-[80px] h-[80px] shrink-0 object-contain"
              />
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0 flex-1">
              <h2 className="font-display font-bold text-[20px] uppercase leading-none text-txt text-balance">
                {champ.title}
              </h2>
              <span className="flex items-center gap-3 whitespace-nowrap">
                <span className="inline-block font-mono text-[11px] tracking-[.35em] uppercase px-2 py-[3px] border text-gold border-gold/40">
                  {champ.classTag}
                </span>
                <span className="font-mono text-[11px] tracking-[.25em] uppercase px-2 py-[2px] border text-txt-3 border-line">
                  <GameLabel game={champ.game} />
                </span>
              </span>
            </div>
          </div>

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
              const rowHasResults = hasResults(champ, round);
              const rowClassName = [
                'flex items-center gap-5 px-6 py-[11px]',
                i < champ.schedule.length - 1 ? 'border-b border-line/50' : '',
                rowHasResults ? 'hover:bg-panel-2 transition-colors' : '',
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

              return rowHasResults ? (
                <Link key={round.round} href={resultsHref(champ, round, sim)} className={rowClassName}>
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
      })}
    </section>
  );
}
