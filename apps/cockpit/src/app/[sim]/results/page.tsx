import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSimBySlug, type SimConfig } from '@/content/sims';
import {
  accsmChampionshipIds,
  roundNights,
  roundStartsAtForDivision,
  type ChampionshipContent,
} from '@/content/championships';
import { getChampionships } from '@/lib/championships-store';
import { getCalendarEvents } from '@/lib/calendar-events-store';
import { getChampionshipStatus, CHAMPIONSHIP_STATUS_LABELS } from '@/lib/championship-status';
import {
  getAccRaceEvents,
  matchAccRoundsToResultEventsFrom,
  SPLIT_NIGHT_MATCH_WINDOW_MS,
  type AccRaceEventSummary,
} from '@/lib/acc/race-results-store';
import { getAccTracks } from '@/lib/acc/tracks';
import { isPracticeRaceEvent, PRACTICE_RACE_GROUPS, type PracticeRaceGroup } from '@/lib/acc/practice-race';
import { getPracticeRaceEvents, type PracticeRaceEvent } from '@/lib/acc/practice-race-store';
import { cleanServerName } from '@/lib/acc/server-name';
import { eventInstant } from '@/lib/event-time';
import { GameLabel } from '@/components/GameLabel';
import { DivisionBadge } from '@/components/DivisionBadge';
import { LocalScheduleDate } from '@/components/LocalScheduleDateTime';

// The results hub: one place to find any race's results without going
// through the calendar. Championship rounds first (per division for a
// split series), then the Monday practice races, then everything else the
// servers recorded. Every result page it links to already existed. This page
// just makes them findable.

export const revalidate = 300;

type RoundLink = { label: React.ReactNode; href: string | null };
type RoundRow = {
  round: number;
  track: string;
  date: string | null;
  raced: boolean;
  links: RoundLink[];
};

const hasStarted = (iso: string | null) => iso != null && eventInstant(iso) <= Date.now();

function buildRoundRows(
  sim: SimConfig,
  champ: ChampionshipContent,
  accEvents: AccRaceEventSummary[],
  matchedEventKeys: Set<string>,
): RoundRow[] {
  const base = `/${sim.slug}/championships/${champ.slug}/results`;
  const targets = champ.accsmTargets ?? [];
  const isAcc = champ.game !== 'AC Evo';

  // Split series: match each division separately, the same way the round
  // results page does (that division's ACCSM championship + night), so a
  // badge here lights up exactly when its page has a result.
  if (isAcc && targets.length > 0) {
    const byDivision = new Map(
      targets.map((t) => {
        const matches = matchAccRoundsToResultEventsFrom(
          accEvents,
          champ.schedule.map((r) => ({ round: r.round, track: r.track, date: roundStartsAtForDivision(r, t.divisionId) })),
          t.emperorChampionshipId,
          SPLIT_NIGHT_MATCH_WINDOW_MS,
        );
        for (const key of matches.values()) matchedEventKeys.add(key);
        return [t.divisionId, matches] as const;
      }),
    );
    return champ.schedule.map((r) => {
      const nights = roundNights(r, targets.map((t) => t.divisionId));
      return {
        round: r.round,
        track: r.track,
        date: nights[0]?.startsAt ?? r.date,
        raced: nights.some((n) => hasStarted(n.startsAt)),
        links: targets.map((t) => ({
          label: <DivisionBadge division={t.divisionId} label={t.divisionName} height={22} />,
          href: byDivision.get(t.divisionId)?.has(r.round) ? `${base}/${r.round}?division=${t.divisionId}` : null,
        })),
      };
    });
  }

  const accMatches = isAcc
    ? matchAccRoundsToResultEventsFrom(accEvents, champ.schedule, accsmChampionshipIds(champ))
    : new Map<number, string>();
  for (const key of accMatches.values()) matchedEventKeys.add(key);
  return champ.schedule.map((r) => ({
    round: r.round,
    track: r.track,
    date: r.date,
    raced: hasStarted(r.date),
    links: [
      {
        label: 'Results',
        href: r.emperorRawTrackName || accMatches.has(r.round) ? `${base}/${r.round}` : null,
      },
    ],
  }));
}

function LinkChip({ link }: { link: RoundLink }) {
  const cls =
    'inline-flex items-center justify-center min-w-[44px] h-[32px] px-2 border font-mono text-[11px] tracking-[.2em] uppercase transition-colors';
  return link.href ? (
    <Link href={link.href} className={`${cls} border-line text-txt-2 hover:border-gold/60 hover:text-gold hover:bg-panel-2`}>
      {link.label}
    </Link>
  ) : (
    <span className={`${cls} border-line/40 text-txt-3/50 opacity-40`} title="No results posted">
      {link.label}
    </span>
  );
}

export default async function SimResultsPage({ params }: { params: Promise<{ sim: string }> }) {
  const { sim: slug } = await params;
  const sim = getSimBySlug(slug);
  if (!sim) notFound();
  const isAcc = sim.game === 'ACC';

  const [championships, calendarEvents, accEvents, tracks] = await Promise.all([
    getChampionships(),
    isAcc ? getCalendarEvents() : Promise.resolve([]),
    isAcc ? getAccRaceEvents() : Promise.resolve([] as AccRaceEventSummary[]),
    isAcc ? getAccTracks() : Promise.resolve([]),
  ]);
  const trackName = new Map(tracks.map((t) => [t.trackKey, t.displayName]));

  // Current seasons first, finished ones after; teasers have nothing to show.
  const champs = championships
    .filter((c) => c.game === sim.game && !c.teaserOnly && c.schedule.length > 0)
    .sort((a, b) => Number(!!a.concluded) - Number(!!b.concluded));

  const matchedEventKeys = new Set<string>();
  const champRows = champs.map((c) => ({ champ: c, rows: buildRoundRows(sim, c, accEvents, matchedEventKeys) }));

  // Monday practice races — newest first, only ones that have happened.
  const practiceEntries = isAcc
    ? calendarEvents.filter((e) => isPracticeRaceEvent(e) && hasStarted(e.eventDate)).reverse()
    : [];
  const practiceResults = await Promise.all(
    practiceEntries.map(async (e) => {
      const groups = await getPracticeRaceEvents(e).catch(() => new Map<PracticeRaceGroup['key'], PracticeRaceEvent>());
      for (const g of groups.values()) matchedEventKeys.add(g.eventKey);
      return { entry: e, groups };
    }),
  );

  // Everything else that produced a race: open lobbies, one-off events,
  // older seasons. Free-practice servers never race, so they're left out.
  const otherRaces = accEvents.filter(
    (e) => e.sessionTypes.includes('Race') && !matchedEventKeys.has(e.eventKey) && !/FreePractice/i.test(e.serverName ?? ''),
  );
  const otherByMonth = new Map<string, AccRaceEventSummary[]>();
  for (const e of otherRaces) {
    const month = new Date(e.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'America/New_York' });
    const list = otherByMonth.get(month);
    if (list) list.push(e);
    else otherByMonth.set(month, [e]);
  }

  const nothing = champRows.length === 0 && practiceResults.length === 0 && otherRaces.length === 0;

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase mb-5" style={{ color: 'var(--sim-accent)' }}>
        — <GameLabel game={sim.game} /> Results
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-14">
        Results
      </h1>

      {nothing && (
        <div className="border border-line/50 bg-carbon-2 px-8 py-12 text-center">
          <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3">No results yet — coming soon</p>
        </div>
      )}

      {champRows.map(({ champ, rows }) => {
        const status = getChampionshipStatus(champ);
        return (
          <div key={champ.slug} className="mb-14">
            <div className="flex flex-wrap items-center gap-4 mb-5">
              {champ.logo && (
                <Image src={champ.logo} alt="" width={64} height={64} className="w-[56px] h-[56px] shrink-0 object-contain" />
              )}
              <div className="min-w-0 flex-1">
                <Link
                  href={`/${sim.slug}/championships/${champ.slug}`}
                  className="font-display font-bold text-[22px] uppercase leading-none text-txt hover:text-gold transition-colors text-balance"
                >
                  {champ.title}
                </Link>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 font-mono text-[11px] tracking-[.2em] uppercase">
                  <span className={status === 'concluded' ? 'text-txt-3' : 'text-gold'}>
                    {CHAMPIONSHIP_STATUS_LABELS[status]}
                  </span>
                  <Link href={`/${sim.slug}/championships/${champ.slug}/standings`} className="text-txt-3 hover:text-gold transition-colors">
                    Standings →
                  </Link>
                  {champ.resultsUrl && (
                    <a href={champ.resultsUrl} target="_blank" rel="noopener noreferrer" className="text-txt-3 hover:text-gold transition-colors">
                      {champ.resultsLabel ?? 'View on SimGrid'} ↗
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="border border-line bg-panel">
              {rows.map((row, i) => (
                <div
                  key={row.round}
                  className={[
                    'flex flex-wrap sm:flex-nowrap items-center gap-x-5 gap-y-2 px-5 py-[10px]',
                    i < rows.length - 1 ? 'border-b border-line/50' : '',
                    row.raced ? '' : 'opacity-50',
                  ].join(' ')}
                >
                  <span className="font-mono text-[14px] tracking-[.2em] uppercase text-gold w-10 shrink-0">R{row.round}</span>
                  <span className="font-display font-bold text-[18px] uppercase leading-none text-txt-2 flex-1 min-w-0 truncate">
                    {row.track}
                  </span>
                  <span className="font-mono text-[12px] text-txt-3 shrink-0 sm:w-[110px]">
                    <LocalScheduleDate iso={row.date} />
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0 basis-full sm:basis-auto pl-[60px] sm:pl-0">
                    {row.raced ? (
                      row.links.map((link, li) => <LinkChip key={li} link={link} />)
                    ) : (
                      <span className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3">Upcoming</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {practiceResults.length > 0 && (
        <div className="mb-14">
          <h2 className="font-display font-bold text-[22px] uppercase leading-none text-txt mb-2">Practice Races</h2>
          <p className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 mb-5">Monday nights · two grids</p>
          <div className="border border-line bg-panel">
            {practiceResults.map(({ entry, groups }, i) => {
              const anyGroup = groups.values().next().value;
              return (
                <div
                  key={entry.id}
                  className={[
                    'flex flex-wrap sm:flex-nowrap items-center gap-x-5 gap-y-2 px-5 py-[10px]',
                    i < practiceResults.length - 1 ? 'border-b border-line/50' : '',
                  ].join(' ')}
                >
                  <Link
                    href={`/${sim.slug}/practice-race/${entry.id}`}
                    className="font-display font-bold text-[18px] uppercase leading-none text-txt-2 hover:text-gold transition-colors flex-1 min-w-0 truncate"
                  >
                    {entry.title}
                    {anyGroup && (
                      <span className="font-sans font-normal normal-case text-[13px] text-txt-3 ml-3">
                        {trackName.get(anyGroup.track) ?? anyGroup.track}
                      </span>
                    )}
                  </Link>
                  <span className="font-mono text-[12px] text-txt-3 shrink-0 sm:w-[110px]">
                    <LocalScheduleDate iso={entry.eventDate} />
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0 basis-full sm:basis-auto">
                    {PRACTICE_RACE_GROUPS.map((g) => (
                      <LinkChip
                        key={g.key}
                        link={{
                          label: (
                            <span className="flex items-center gap-0.5">
                              {g.divisionIds.map((d) => (
                                <DivisionBadge key={d} division={d} height={20} />
                              ))}
                            </span>
                          ),
                          href: groups.has(g.key) ? `/${sim.slug}/practice-race/${entry.id}/${g.key}` : null,
                        }}
                      />
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {otherRaces.length > 0 && (
        <details className="group mb-14">
          <summary className="cursor-pointer list-none flex items-center gap-3 mb-5">
            <h2 className="font-display font-bold text-[22px] uppercase leading-none text-txt">Other Server Races</h2>
            <span className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3">
              {otherRaces.length} · open lobbies &amp; one-offs
            </span>
            <span className="font-mono text-[11px] text-txt-3 transition-transform group-open:rotate-180">▾</span>
          </summary>
          {[...otherByMonth.entries()].map(([month, events]) => (
            <div key={month} className="mb-8">
              <p className="font-mono text-[11px] tracking-[.3em] uppercase text-txt-3 mb-3">{month}</p>
              <div className="border border-line bg-panel">
                {events.map((e, i) => (
                  <Link
                    key={e.eventKey}
                    href={`/${sim.slug}/results/${encodeURIComponent(e.eventKey)}`}
                    className={[
                      'flex flex-wrap sm:flex-nowrap items-center gap-x-5 gap-y-1 px-5 py-[10px] hover:bg-panel-2 transition-colors',
                      i < events.length - 1 ? 'border-b border-line/50' : '',
                    ].join(' ')}
                  >
                    <span className="font-display font-bold text-[16px] uppercase leading-none text-txt-2 flex-1 min-w-0 truncate">
                      {trackName.get(e.track) ?? e.track}
                    </span>
                    <span className="font-sans text-[13px] text-txt-3 order-last sm:order-none basis-full sm:basis-0 flex-1 min-w-0 truncate">
                      {cleanServerName(e.serverName)}
                    </span>
                    <span className="font-mono text-[12px] text-txt-3 shrink-0">
                      {new Date(e.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'America/New_York',
                      })}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}
