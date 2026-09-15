import type {
  EmperorChampionshipStandings,
  EmperorDriverStanding,
  EmperorTeamStanding,
} from '@sra/shared-types';
import {
  accsmTargetForDivision,
  getStandingsKey,
  roundStartsAtForDivision,
  isMultiDivision,
  type ChampionshipContent,
} from '@/content/championships';
import {
  parseStandingsView,
  resolveActiveDivision,
  type StandingsView,
} from '@/lib/standings-view';
import { getCurrentDriverContext } from '@/lib/current-driver';
import { DivisionTabs, StandingsViewControls } from './StandingsControls';
import { TeamStandingsTable } from './TeamStandingsTable';
import { buildTeamRosters } from '@/lib/team-rosters';
import { getAcEvoStandings, getAccStandings } from '@/lib/emperor-standings';
import { getRoundPoints } from '@/lib/acevo-hotlaps';
import { getChampionshipRoundEvents } from '@/lib/acc/championship-rounds';
import { SPLIT_NIGHT_MATCH_WINDOW_MS } from '@/lib/acc/round-match';
import type { RoundEvent } from '@sra/domain';
import { readStandings } from '@/lib/standings-store';
import { stripSteamIdPrefix, type DriverInfo } from '@/lib/driver-lookup';
import { getDriverInfoForStandings, getEntryListAsZeroStandings } from '@/lib/entry-list-standings';
import { EmperorStandingsTable } from './EmperorStandingsTable';
import { ClassStandingsTabs } from './ClassStandingsTabs';
import { AcEvoRaceResultsTabs } from './AcEvoRaceResultsTabs';

export async function ChampionshipStandingsBody({
  champ,
  basePath,
  searchParams,
}: {
  champ: ChampionshipContent;
  // Where the division/entrant/tier controls link back to. Optional so the
  // single-championship call sites don't have to thread it; a multi-division
  // championship rendered without it falls back to its own canonical
  // standings URL rather than linking to whatever page embedded it.
  basePath?: string;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  if (isMultiDivision(champ)) {
    return (
      <MultiDivisionStandingsSection
        champ={champ}
        basePath={basePath ?? defaultStandingsPath(champ)}
        view={parseStandingsView(searchParams ?? {})}
      />
    );
  }
  if (champ.emperorChampionshipId) return <AcEvoStandingsSection champ={champ} />;
  if (!champ.teaserOnly && getStandingsKey(champ)) return <LocalStandingsSection champ={champ} />;

  return (
    <div className="border border-line/50 bg-carbon-2 px-8 py-12 text-center">
      <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3">Coming soon</p>
    </div>
  );
}

async function LocalStandingsSection({ champ }: { champ: ChampionshipContent }) {
  const key = getStandingsKey(champ)!;
  const localStandings = await readStandings(key);

  if (!localStandings) {
    return (
      <div className="border border-gold-deep/30 bg-gold-deep/5 px-5 py-4">
        <p className="font-mono text-[15px] tracking-[.15em] uppercase text-gold-deep">
          No standings data uploaded yet
        </p>
        <p className="font-sans text-[15px] text-txt-3 mt-1">
          Upload standings with key &quot;{key}&quot; via /admin/standings.
        </p>
      </div>
    );
  }

  return (
    <div>
      <ClassStandingsTabs groups={localStandings} />
      {champ.resultsUrl && (
        <div className="mt-8 pt-5 border-t border-line">
          <a
            href={champ.resultsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[12px] tracking-[.15em] uppercase text-gold hover:text-gold-soft transition-colors"
          >
            {champ.resultsLabel ?? 'View results'} →
          </a>
        </div>
      )}
    </div>
  );
}

async function AcEvoStandingsSection({ champ }: { champ: ChampionshipContent }) {
  // ACC's emperor_championship_id lives on one of 7 ACCSM instances (there's
  // no single well-known ACC Emperor host the way AC Evo has one) — see
  // lib/emperor-standings.ts's getAccStandings for how that's resolved.
  // Component name is legacy (predates ACC using this same section); not
  // worth a rename churn on its own.
  const result =
    champ.game === 'AC Evo'
      ? await getAcEvoStandings(champ.emperorChampionshipId!)
      : await getAccStandings(champ.emperorChampionshipId!);

  if (!result.ok) {
    return (
      <div className="border border-line/50 bg-carbon-2 px-8 py-12 text-center">
        <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 mb-3">
          Standings temporarily unavailable
        </p>
        <p className="font-sans text-[15px] text-txt-3">
          Emperor&apos;s live data couldn&apos;t be reached. Try again shortly.
        </p>
      </div>
    );
  }

  const isEmpty = Object.values(result.data.driverStandings).every((s) => s.length === 0);
  if (isEmpty) {
    const entryListStandings =
      champ.registrationKey && champ.registrationSeason
        ? await getEntryListAsZeroStandings(champ.registrationKey, champ.registrationSeason, champ.classTag)
        : null;

    if (entryListStandings) {
      return (
        <div>
          <p className="font-mono text-[12px] tracking-[.1em] uppercase text-txt-3 italic mb-4">
            No races scored yet — showing the confirmed entry list at 0 points.
          </p>
          <EmperorStandingsTable
            data={entryListStandings}
            driverInfo={await getDriverInfoForStandings(entryListStandings)}
          />
        </div>
      );
    }

    return (
      <div className="border border-line/50 bg-carbon-2 px-8 py-12 text-center">
        <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3">
          No standings posted yet
        </p>
      </div>
    );
  }

  // ACC (LIAW and any other single-championship ACC event): round columns
  // from Emperor's per-event points joined to our ingested race sessions —
  // the same path the multi-division Team Series uses.
  if (champ.game !== 'AC Evo') {
    const rounds = await getChampionshipRoundEvents(champ.emperorChampionshipId!, result.data, champ.schedule);
    return (
      <EmperorStandingsTable
        data={result.data}
        rounds={rounds}
        driverInfo={await getDriverInfoForStandings(result.data)}
      />
    );
  }

  // AC Evo's per-round points come from OUR round-points cache (positions +
  // pole/fastest-lap bonuses computed from downloaded results), not from
  // Emperor's per-event map, and are keyed by track rather than event id.
  // Adapt them to the table's RoundEvent shape: one synthetic event per
  // scheduled round, and each driver's eventPoints rewritten to those ids.
  // No race results are attached, so cells show points only — no finish
  // colour or fastest-lap marks here (that data lives in the ACC ingest).
  const roundsWithTrack = champ.schedule.filter((r) => r.emperorRawTrackName);
  const roundPoints = await Promise.all(
    roundsWithTrack.map(async (r) => ({
      eventId: `acevo-round-${r.round}`,
      round: r.round,
      track: r.track,
      points: await getRoundPoints(r.emperorRawTrackName!, r.emperorTrack),
    })),
  );
  const rounds: RoundEvent[] = roundPoints.map(({ eventId, round, track }) => ({
    eventId,
    round,
    track,
    races: [],
  }));
  const withRoundPoints: EmperorChampionshipStandings = {
    ...result.data,
    driverStandings: Object.fromEntries(
      Object.entries(result.data.driverStandings).map(([cls, standings]) => [
        cls,
        standings.map((d) => ({
          ...d,
          eventPoints: Object.fromEntries(
            roundPoints
              .filter((r) => d.steamId in r.points)
              .map((r) => [r.eventId, r.points[d.steamId]]),
          ),
          droppedEventIds: [],
        })),
      ]),
    ),
  };

  return (
    <div>
      <EmperorStandingsTable
        data={withRoundPoints}
        rounds={rounds}
        driverInfo={await getDriverInfoForStandings(result.data)}
      />
      {roundsWithTrack.length > 0 && (
        <AcEvoRaceResultsTabs
          rounds={roundsWithTrack.map((r) => ({
            round: r.round,
            track: r.track,
            trackKey: r.emperorRawTrackName!,
          }))}
        />
      )}
    </div>
  );
}

// ── Multi-division series (GT3 Team Series) ────────────────────────────────
//
// One championships row, N ACCSM championships — one per division, from
// championship_accsm_targets. Each division is a genuinely separate Emperor
// championship with its own standings, so switching division is a server
// fetch, not a client toggle. See lib/standings-view.ts.

// Sim slug isn't on ChampionshipContent, so derive the standings URL from the
// game. Only ACC runs a multi-division series today; the fallback keeps this
// total rather than throwing on a shape that doesn't exist yet.
function defaultStandingsPath(champ: ChampionshipContent): string {
  const simSlug = champ.game === 'ACC' ? 'acc' : champ.game === 'LMU' ? 'lmu' : 'acevo';
  return `/${simSlug}/championships/${champ.slug}/standings`;
}

// Narrows a division's standings to one tier and re-ranks it 1..n as its own
// sub-championship.
//
// SRA scores a separate Silver championship alongside the overall (Gold) one,
// so "P1 in Silver" is a real standing a driver holds, not a filtered view of
// the overall table — hence the renumbering. Points are deliberately NOT
// recomputed: a driver carries the same championship points either way, and
// the sub-championship differs only in who they are ranked against. Anything
// that changed points here would be inventing a scoring system that lives in
// the league rules, not in this component.
//
// A steamId with no drivers row (a guest, or an unlinked Steam account) has no
// tier and is excluded from both Gold and Silver — it belongs to neither, and
// silently bucketing it into one would misreport a classification.
function filterAndRankByTier(
  standings: EmperorDriverStanding[],
  driverInfo: Record<string, DriverInfo>,
  tier: StandingsView['tier'],
): EmperorDriverStanding[] {
  if (tier === 'all') return standings;

  return (
    standings
      .filter((e) => driverInfo[stripSteamIdPrefix(e.steamId)]?.tier === tier)
      // Sort before renumbering rather than trusting arrival order: the rank
      // we assign has to follow the ranking Emperor already computed, and
      // renumbering an unordered list would produce confident nonsense.
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((entry, i) => ({ ...entry, position: i + 1 }))
  );
}

async function MultiDivisionStandingsSection({
  champ,
  basePath,
  view,
}: {
  champ: ChampionshipContent;
  basePath: string;
  view: StandingsView;
}) {
  const targets = champ.accsmTargets ?? [];
  if (targets.length === 0) return <ComingSoon />;

  // Same precedence as the results page: an explicit ?division= wins, else the
  // signed-in viewer's own division, else the first the series runs. An
  // out-of-range value falls back rather than 404ing — a division can
  // legitimately disappear between someone bookmarking a tab and loading it (a
  // division that didn't fill, a season with fewer grids).
  //
  // Looked up only when no division was asked for, and costs no extra
  // rendering: this page already reads searchParams, so it is dynamic anyway.
  const viewerDivision = view.division == null ? (await getCurrentDriverContext()).division : null;
  const activeDivision = resolveActiveDivision(
    view.division,
    viewerDivision,
    targets.map((t) => t.divisionId),
  )!;
  const target = accsmTargetForDivision(champ, activeDivision)!;

  // Pin the resolved division into the view the controls build URLs from. When
  // it came from the viewer's own driver row the URL carries no ?division=, and
  // leaving it null would make every entrant/tier link re-resolve on the next
  // request — same answer today, but it silently changes if they sign out in
  // another tab. Explicit links say what they mean.
  const resolvedView: StandingsView = { ...view, division: activeDivision };

  const tabs = (
    <DivisionTabs
      targets={targets}
      basePath={basePath}
      view={resolvedView}
      activeDivision={activeDivision}
    />
  );

  const result = await getAccStandings(target.emperorChampionshipId);

  if (!result.ok) {
    return (
      <div>
        {tabs}
        <div className="border border-line/50 bg-carbon-2 px-8 py-12 text-center">
          <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 mb-3">
            Standings temporarily unavailable
          </p>
          <p className="font-sans text-[15px] text-txt-3">
            Emperor&apos;s live data couldn&apos;t be reached for {target.divisionName}. Try again
            shortly.
          </p>
        </div>
      </div>
    );
  }

  const hasTeamStandings = Object.values(result.data.teamStandings).some((t) => t.length > 0);
  const isEmpty = Object.values(result.data.driverStandings).every((s) => s.length === 0);

  // Before any race is scored, show this division's confirmed entry list at 0
  // points — scoped to the division, so D1's tab never shows D4's entrants.
  if (isEmpty) {
    const entryListStandings =
      champ.registrationKey && champ.registrationSeason
        ? await getEntryListAsZeroStandings(
            champ.registrationKey,
            champ.registrationSeason,
            champ.classTag,
            activeDivision,
          )
        : null;

    if (!entryListStandings) {
      return (
        <div>
          {tabs}
          <div className="border border-line/50 bg-carbon-2 px-8 py-12 text-center">
            <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3">
              No standings posted yet for {target.divisionName}
            </p>
          </div>
        </div>
      );
    }

    const driverInfo = await getDriverInfoForStandings(entryListStandings);

    const preRaceNote = (
      <p className="font-mono text-[12px] tracking-[.1em] uppercase text-txt-3 italic mb-4">
        No races scored yet — showing {target.divisionName}&apos;s confirmed entry list at 0
        points.
      </p>
    );

    // Teams view before any race: the same entry list grouped by team, every
    // team at 0. Emperor has no team rows yet, but the registrations DO know
    // the teams (teamNames on each driver row, via getEntryListAsZeroStandings),
    // so the toggle is offered here too — it's the only way to see rosters
    // before R1, which is exactly when people are checking who's paired with
    // whom. Alphabetical, since there's nothing to rank on.
    if (view.entrant === 'teams') {
      const rosters = buildTeamRosters(entryListStandings.driverStandings);
      const teamGroups: [string, EmperorTeamStanding[]][] = Object.entries(
        entryListStandings.driverStandings,
      ).map(([className, standings]) => {
        const names = [...new Set(standings.flatMap((d) => d.teamNames))].sort((a, b) =>
          a.localeCompare(b),
        );
        return [
          className,
          names.map((teamName, i) => ({
            position: i + 1,
            teamName,
            points: 0,
            pointsPenalty: 0,
            droppedEventIds: [],
          })),
        ];
      });

      return (
        <div>
          {tabs}
          <StandingsViewControls basePath={basePath} view={resolvedView} hasTeamStandings />
          {preRaceNote}
          <TeamStandingsTable groups={teamGroups} rosters={rosters} driverInfo={driverInfo} />
        </div>
      );
    }

    const groups = Object.entries(entryListStandings.driverStandings).map(
      ([className, standings]) =>
        [className, filterAndRankByTier(standings, driverInfo, view.tier)] as const,
    );

    return (
      <div>
        {tabs}
        <StandingsViewControls basePath={basePath} view={resolvedView} hasTeamStandings />
        <SubChampionshipNote tier={view.tier} />
        {preRaceNote}
        <EmperorStandingsTable
          data={{
            driverStandings: Object.fromEntries(groups),
            teamStandings: {},
          }}
          driverInfo={driverInfo}
        />
        <EmptyTierNote groups={groups} tier={view.tier} />
      </div>
    );
  }

  // Round columns: this division's ingested races, labelled from the
  // schedule. Same division-aware dates + split-night window the results page
  // uses, so D1/D3's Tuesday race never matches D2/D4's Wednesday one at the
  // same track (see round-match.ts / roundStartsAtForDivision).
  const rounds = await getChampionshipRoundEvents(
    target.emperorChampionshipId,
    result.data,
    champ.schedule.map((r) => ({
      round: r.round,
      track: r.track,
      date: roundStartsAtForDivision(r, activeDivision),
    })),
    SPLIT_NIGHT_MATCH_WINDOW_MS,
  );

  if (view.entrant === 'teams') {
    // Rosters come from the DRIVER standings (the only place Emperor records
    // team membership), so the driver lookup is needed on this view too — the
    // badges shown are each driver's own classification. The team championship
    // itself is tierless, which is why no Gold/Silver control renders here.
    const rosters = buildTeamRosters(result.data.driverStandings);
    return (
      <div>
        {tabs}
        <StandingsViewControls basePath={basePath} view={resolvedView} hasTeamStandings={hasTeamStandings} />
        <TeamStandingsTable
          groups={Object.entries(result.data.teamStandings)}
          rosters={rosters}
          driverInfo={await getDriverInfoForStandings(result.data)}
          rounds={rounds}
          driverStandings={result.data.driverStandings}
        />
      </div>
    );
  }

  const driverInfo = await getDriverInfoForStandings(result.data);
  const groups = Object.entries(result.data.driverStandings).map(
    ([className, standings]) => [className, filterAndRankByTier(standings, driverInfo, view.tier)] as const,
  );

  return (
    <div>
      {tabs}
      <StandingsViewControls basePath={basePath} view={resolvedView} hasTeamStandings={hasTeamStandings} />
      <SubChampionshipNote tier={view.tier} />
      <EmperorStandingsTable
        data={{ driverStandings: Object.fromEntries(groups), teamStandings: {} }}
        rounds={rounds}
        driverInfo={driverInfo}
      />
      <EmptyTierNote groups={groups} tier={view.tier} />
    </div>
  );
}

// Makes the renumbering legible. Without this, "P1" under a Silver filter is
// ambiguous between "leads the Silver championship" and "leads the division" —
// and the points column (which stays the overall championship points, see
// filterAndRankByTier) would look like it disagreed with the rank.
function SubChampionshipNote({ tier }: { tier: StandingsView['tier'] }) {
  if (tier === 'all') return null;
  const label = tier === 'gold' ? 'Gold' : 'Silver';
  return (
    <p className="font-sans text-[13px] text-txt-3 mb-4">
      <span className="font-mono text-[11px] tracking-[.2em] uppercase text-gold mr-2">
        {label} Championship
      </span>
      Ranked among {label} drivers only. Points shown are each driver&apos;s overall
      championship points.
    </p>
  );
}

// A tier filter that matches nobody renders an empty table, which reads as
// "standings failed to load". Say which it is.
function EmptyTierNote({
  groups,
  tier,
}: {
  groups: readonly (readonly [string, EmperorDriverStanding[]])[];
  tier: StandingsView['tier'];
}) {
  if (tier === 'all' || groups.some(([, s]) => s.length > 0)) return null;
  return (
    <p className="font-sans text-[15px] text-txt-3 mt-4">
      No {tier} drivers in this division yet.
    </p>
  );
}

function ComingSoon() {
  return (
    <div className="border border-line/50 bg-carbon-2 px-8 py-12 text-center">
      <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3">Coming soon</p>
    </div>
  );
}
