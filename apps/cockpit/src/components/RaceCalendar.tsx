import { Fragment } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { SIMS, type SimConfig } from '@/content/sims';
import { formatScheduleDateTime } from '@/lib/schedule-format';
import { getChampionships } from '@/lib/championships-store';
import { CalendarGrid, type CalendarGridEvent } from '@/components/CalendarGrid';
import { DivisionBadge } from '@/components/DivisionBadge';
import { practiceRaceHref } from '@/lib/acc/practice-race';
import { GameLabel } from '@/components/GameLabel';
import { LocalScheduleDate, LocalScheduleTime } from '@/components/LocalScheduleDateTime';
import { getCalendarEvents } from '@/lib/calendar-events-store';
import { getAccRaceEvents, matchAccRoundsToResultEventsFrom } from '@/lib/acc/race-results-store';
import {
  accsmChampionshipIds,
  roundNights,
  type ChampionshipContent,
  type ScheduleRound,
} from '@/content/championships';

// THE race calendar. /calendar renders it unfiltered and /[sim]/calendar
// renders it filtered to one sim. It used to be two hand-maintained pages
// that drifted: different entry labels, different rules for which admin
// entries showed, and a schedule list that showed only Tuesday for a round
// raced Tuesday and Wednesday. So a sim's calendar read like a different,
// thinner calendar rather than the same one with a filter on, which is what
// people expect. One component keeps them the same by construction.

export async function RaceCalendar({ sim }: { sim?: SimConfig }) {
  const [championships, calendarEvents] = await Promise.all([getChampionships(), getCalendarEvents()]);
  const inView = (c: ChampionshipContent) => !sim || c.game === sim.game;
  const teasedChamps = championships.filter((c) => inView(c) && c.teaserOnly);
  const realChamps = championships.filter((c) => inView(c) && c.schedule.length > 0 && !c.teaserOnly);
  const simFor = (game: string | null) => (game ? SIMS.find((s) => s.game === game) : undefined);

  // One acc_race_sessions fetch shared across every ACC championship on the
  // page. See matchAccRoundsToResultEventsFrom.
  const accChamps = realChamps.filter((c) => c.game !== 'AC Evo');
  const accEvents = accChamps.length > 0 ? await getAccRaceEvents() : [];
  const roundsWithResultsByChamp = new Map<string, Set<number>>(
    accChamps.map((c) => [
      c.slug,
      new Set(matchAccRoundsToResultEventsFrom(accEvents, c.schedule, accsmChampionshipIds(c)).keys()),
    ]),
  );
  const hasResults = (champ: ChampionshipContent, round: ScheduleRound) =>
    Boolean(round.emperorRawTrackName) || (roundsWithResultsByChamp.get(champ.slug)?.has(round.round) ?? false);
  const champHref = (champ: ChampionshipContent) => {
    const s = simFor(champ.game);
    return s ? `/${s.slug}/championships/${champ.slug}` : '/calendar';
  };
  const roundHref = (champ: ChampionshipContent, round: ScheduleRound) =>
    hasResults(champ, round) ? `${champHref(champ)}/results/${round.round}` : champHref(champ);

  // One entry PER NIGHT, not per round: a split-night series races the same
  // round across two evenings, and each entry badges the divisions racing it.
  const gridEvents: CalendarGridEvent[] = realChamps.flatMap((champ) => {
    const divisionIds = champ.accsmTargets?.map((t) => t.divisionId) ?? [];
    return champ.schedule.flatMap((round) =>
      roundNights(round, divisionIds)
        .filter((night) => night.startsAt)
        .map((night) => ({
          iso: night.startsAt!,
          title: `${champ.game} · R${round.round} · ${round.track}`,
          href: roundHref(champ, round),
          color: simFor(champ.game)?.accentColor,
          divisionIds: night.divisionIds,
        })),
    );
  });

  // Admin-managed entries (deadlines, streams, practice races). A sim's view
  // keeps its own plus every league-wide one (no game set). A reveal stream
  // or orientation night concerns everyone, and dropping it from a filtered
  // view is exactly the "this isn't the same calendar" gap being fixed here.
  for (const e of calendarEvents) {
    if (sim && e.game && e.game !== sim.game) continue;
    gridEvents.push({
      iso: e.eventDate,
      title: e.title,
      href: e.href ?? practiceRaceHref(e) ?? (sim ? `/${sim.slug}/calendar` : '/calendar'),
      color: e.color ?? simFor(e.game)?.accentColor,
    });
  }

  const filterChip = (label: React.ReactNode, href: string, active: boolean, color?: string) => (
    <Link
      key={href}
      href={href}
      aria-current={active ? 'page' : undefined}
      className={[
        'inline-flex items-center gap-2 font-mono text-[11px] tracking-[.2em] uppercase px-3 py-[7px] border transition-colors whitespace-nowrap',
        active ? 'text-txt bg-panel-2' : 'text-txt-3 border-line hover:text-txt hover:border-line-2',
      ].join(' ')}
      style={active ? { borderColor: color ?? 'var(--color-gold)' } : undefined}
    >
      {color && <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ backgroundColor: color }} />}
      {label}
    </Link>
  );

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span
        className="block font-mono text-[15px] tracking-[.3em] uppercase mb-5"
        style={{ color: sim ? 'var(--sim-accent)' : 'var(--color-gold)' }}
      >
        — {sim ? <GameLabel game={sim.game} /> : null}
        {sim ? ' ' : ''}Calendar
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-8">
        Race Calendar
      </h1>

      <nav aria-label="Filter by sim" className="flex flex-wrap items-center gap-2 mb-8">
        {filterChip('All sims', '/calendar', !sim)}
        {SIMS.map((s) =>
          filterChip(<GameLabel game={s.game} />, `/${s.slug}/calendar`, sim?.slug === s.slug, s.accentColor),
        )}
      </nav>

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
                  <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3">Coming Soon</p>
                </div>
              </div>
            </Fragment>
          ))}
        </div>
      )}

      {realChamps.map((champ) => {
        const divisionIds = champ.accsmTargets?.map((t) => t.divisionId) ?? [];
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
                <Link
                  href={champHref(champ)}
                  className="font-display font-bold text-[20px] uppercase leading-none text-txt text-balance hover:text-gold transition-colors"
                >
                  {champ.title}
                </Link>
                <span className="flex items-center gap-3 whitespace-nowrap">
                  <span className="inline-block font-mono text-[11px] tracking-[.35em] uppercase px-2 py-[3px] border text-gold border-gold/40">
                    {champ.classTag}
                  </span>
                  {!sim && (
                    <span className="font-mono text-[11px] tracking-[.25em] uppercase px-2 py-[2px] border text-txt-3 border-line">
                      <GameLabel game={champ.game} />
                    </span>
                  )}
                </span>
              </div>
            </div>

            <div className="mb-5 space-y-1">
              {champ.raceDays && (
                <p className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-2">{champ.raceDays}</p>
              )}
              <p className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3">{champ.raceFormat}</p>
            </div>

            <div className="border border-line bg-panel">
              {champ.schedule.map((round, i) => {
                const rowHasResults = hasResults(champ, round);
                // Every night the round is raced on. A split-night round
                // (D1/D3 Tuesday, D2/D4 Wednesday) lists both, badged.
                const nights = roundNights(round, divisionIds);
                const rowClassName = [
                  'flex flex-wrap sm:flex-nowrap items-center gap-x-5 gap-y-2 px-6 py-[11px]',
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
                    <span className="flex flex-col items-start sm:items-end gap-1 shrink-0 order-last sm:order-none basis-full sm:basis-auto pl-[60px] sm:pl-0">
                      {nights.map((night, ni) => (
                        <span key={ni} className="flex items-center gap-2">
                          {night.divisionIds.length > 0 && (
                            <span className="flex items-center gap-0.5 shrink-0">
                              {night.divisionIds.map((d) => (
                                <DivisionBadge key={d} division={d} height={16} />
                              ))}
                            </span>
                          )}
                          <span className="font-display font-bold text-[15px] sm:text-[18px] uppercase leading-none text-txt whitespace-nowrap">
                            <LocalScheduleDate iso={night.startsAt} />
                          </span>
                          {formatScheduleDateTime(night.startsAt).time && (
                            <>
                              <span className="text-txt-3">·</span>
                              <span className="font-mono text-[12px] sm:text-[14px] tracking-[.1em] text-txt-2 whitespace-nowrap">
                                <LocalScheduleTime iso={night.startsAt} />
                              </span>
                            </>
                          )}
                        </span>
                      ))}
                    </span>
                    <span className="font-mono text-[13px] tracking-[.1em] uppercase shrink-0 sm:w-28 text-right">
                      {rowHasResults ? (
                        <span className="text-gold">Results →</span>
                      ) : (
                        <span className="text-txt-3/70">{round.raceLength}</span>
                      )}
                    </span>
                  </>
                );

                return rowHasResults ? (
                  <Link key={round.round} href={roundHref(champ, round)} className={rowClassName}>
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
