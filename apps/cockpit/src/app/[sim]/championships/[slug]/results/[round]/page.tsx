import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { getChampionships } from '@/lib/championships-store';
import {
  accsmTargetForDivision,
  isMultiDivision,
  roundStartsAtForDivision,
} from '@/content/championships';
import { parseStandingsView, resolveActiveDivision } from '@/lib/standings-view';
import { getCurrentDriverContext } from '@/lib/current-driver';
import { DivisionTabs } from '@/components/StandingsControls';
import { AcEvoResultsTabs } from '@/components/AcEvoResultsTabs';
import { ResultsTabs } from '@/components/ResultsTabs';
import {
  getAccRaceEventSessions,
  matchAccRoundsToResultEvents,
  SPLIT_NIGHT_MATCH_WINDOW_MS,
} from '@/lib/acc/race-results-store';
import { getDriverInfoBySteamIds } from '@/lib/driver-lookup';

type PageProps = {
  params: Promise<{ sim: string; slug: string; round: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ChampionshipRoundResultsPage({ params, searchParams }: PageProps) {
  const { sim: simSlug, slug, round: roundParam } = await params;
  const query = await searchParams;
  const sim = getSimBySlug(simSlug);
  if (!sim) notFound();

  const content = (await getChampionships()).find((c) => c.game === sim.game && c.slug === slug);
  if (!content) notFound();

  const roundNumber = Number(roundParam);
  const round = content.schedule.find((r) => r.round === roundNumber);
  if (!round) notFound();

  // AC Evo looks up Emperor's results API directly by the round's own
  // emperorRawTrackName field (content-authored). ACC has no such field —
  // its round is matched to an acc_race_sessions event instead (see
  // matchAccRoundsToResultEvents for why that needs both a championship_id
  // pass and a track+date fallback, and RealChampionshipBlock's
  // roundsWithResults for the same match used to decide whether this round's
  // card was even shown as a link).
  // ── Division selection (multi-division series only) ──────────────────────
  //
  // Each division of the GT3 Team Series races its own ACCSM championship, on
  // its own night. So "round 1's results" is four different races, and the page
  // has to say which one it is showing.
  const view = parseStandingsView(query);
  const targets = content.accsmTargets ?? [];
  const multiDivision = isMultiDivision(content);
  // A driver landing on "round 1 results" almost always wants THEIR race, not
  // Division 1's. Only looked up when they haven't asked for a specific
  // division — an explicit ?division= (a shared link, a tab click) always wins.
  //
  // No extra rendering cost: this page already reads searchParams, so it is
  // dynamically rendered either way.
  const viewerDivision =
    multiDivision && view.division == null ? (await getCurrentDriverContext()).division : null;

  const activeDivision = multiDivision
    ? resolveActiveDivision(
        view.division,
        viewerDivision,
        targets.map((t) => t.divisionId),
      )
    : null;

  // The two things that make the match division-correct:
  //
  //  1. THIS division's ACCSM championship id. That is the reliable pass —
  //     an exact key, not an inference — and it is only available per division
  //     because a multi-division series has no single championship id.
  //  2. THIS division's start time, since a split-night round happens on two
  //     different nights, plus a window tight enough that Tuesday's race and
  //     Wednesday's race at the same track cannot cross-match in the fallback
  //     pass ACCSM Custom Races fall into.
  const divisionChampionshipId =
    activeDivision != null
      ? (accsmTargetForDivision(content, activeDivision)?.emperorChampionshipId ?? null)
      : (content.emperorChampionshipId ?? null);

  const matchSchedule = multiDivision
    ? content.schedule.map((r) => ({
        round: r.round,
        track: r.track,
        date: roundStartsAtForDivision(r, activeDivision),
      }))
    : content.schedule;

  const accEventKey =
    content.game !== 'AC Evo'
      ? (
          await matchAccRoundsToResultEvents(
            matchSchedule,
            divisionChampionshipId,
            multiDivision ? SPLIT_NIGHT_MATCH_WINDOW_MS : undefined,
          )
        ).get(round.round)
      : undefined;
  const accSessions = accEventKey ? await getAccRaceEventSessions(accEventKey) : null;

  // The date shown under the title is THIS division's night. Reading
  // round.date directly would show D2/D4 the Tuesday they don't race on.
  const roundDate = roundStartsAtForDivision(round, activeDivision);

  // A multi-division series must NOT 404 here: the other divisions' tabs are
  // the whole point of the page, and one division having no result yet (it
  // races tomorrow night) is a normal state, not a missing page.
  if (!multiDivision && !round.emperorRawTrackName && !accSessions) notFound();

  // Division/tier badges (DriverTierBadge.tsx) need each row's driver info —
  // ResultsTabs is a client component, so the batch lookup happens here and
  // rides along as a prop, same as AcEvoResultsTabs' driverInfo (see
  // [sim]/standings/actions.ts).
  const accDriverInfo = accSessions
    ? Object.fromEntries(
        await getDriverInfoBySteamIds(
          accSessions.flatMap((s) =>
            s.results.map((r) => r.currentDriverSteamId ?? r.drivers[0]?.steamId).filter((id) => !!id),
          ),
        ),
      )
    : {};

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <Link
        href={`/${sim.slug}/championships/${slug}`}
        className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 hover:text-gold transition-colors mb-5"
      >
        ← {content.title}
      </Link>
      <span
        className="block font-mono text-[15px] tracking-[.3em] uppercase mb-5"
        style={{ color: 'var(--sim-accent)' }}
      >
        — Round {round.round} Results
      </span>
      <h1 className="font-display font-black text-[clamp(36px,5vw,64px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-3">
        {round.track}
      </h1>
      {multiDivision && activeDivision != null && (
        <div className="mt-8">
          <DivisionTabs
            targets={targets}
            basePath={`/${simSlug}/championships/${slug}/results/${round.round}`}
            view={{ ...view, division: activeDivision }}
            activeDivision={activeDivision}
          />
        </div>
      )}
      {multiDivision && !accSessions && (
        <div className="border border-line/50 bg-carbon-2 px-8 py-12 text-center mb-10">
          <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3">
            No results posted yet for this division
          </p>
        </div>
      )}
      {roundDate && (
        <p className="font-mono text-[12px] text-txt-3 mb-10">
          {new Date(roundDate).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      )}

      {accSessions ? (
        <ResultsTabs sessions={accSessions} driverInfo={accDriverInfo} />
      ) : (
        <AcEvoResultsTabs trackKey={round.emperorRawTrackName!} />
      )}
    </section>
  );
}
