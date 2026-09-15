import { accCarModelName } from '@sra/domain';
import type {
  EmperorChampionshipStandings,
  EmperorDriverStanding,
  EmperorTeamStanding,
} from '@sra/shared-types';
import {
  accsmTargetForDivision,
  getStandingsKey,
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
import { readStandings } from '@/lib/standings-store';
import { getDriverInfoBySteamIds, stripSteamIdPrefix, type DriverInfo } from '@/lib/driver-lookup';
import { supabase as adminClient } from '@/lib/supabase';
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

type RawEntryDriverJoin = {
  driver_id: string;
  drivers: { display_name: string | null; steam_id: string | null } | null;
};
type RawEntryJoin = {
  car_model_id: number | null;
  teams: { name: string } | { name: string }[] | null;
  registration_drivers: RawEntryDriverJoin[] | null;
};

// Before Emperor has any race results, its championship standings endpoint
// returns empty class groups (confirmed live for both LIAW and GT3 Team
// Series S19 — see the ACC-standings-server fix's PR). Rather than a bare
// "no standings yet" message, show the confirmed entry list itself at 0
// points — same registrations/registration_drivers data the register page's
// entry list reads, just reshaped into EmperorStandingsTable's format. Only
// possible for a championship that actually runs through our own
// registration system (registrationKey/registrationSeason set) — an AC Evo
// championship with no registration flow simply keeps the plain message.
async function getEntryListAsZeroStandings(
  championshipKey: string,
  season: string,
  classTag: string,
  // Multi-division series only. One registration_key covers every division, so
  // without this every division's tab would show the whole series' entry list.
  divisionId?: number,
): Promise<EmperorChampionshipStandings | null> {
  let query = adminClient
    .from('registrations')
    .select('car_model_id, teams(name), registration_drivers(driver_id, drivers(display_name, steam_id))')
    .eq('championship_key', championshipKey)
    .eq('season', season)
    .eq('status', 'confirmed');

  if (divisionId != null) query = query.eq('division_id', divisionId);

  const { data } = await query;

  const entries = ((data ?? []) as unknown as RawEntryJoin[])
    .flatMap((r) =>
      (r.registration_drivers ?? []).map((rd) => ({
        driverName: rd.drivers?.display_name ?? 'Unknown Driver',
        // Mirrors Emperor's per-driver Teams map, so this pre-race shape and
        // the live one agree on where team membership is recorded.
        teamNames: [(Array.isArray(r.teams) ? r.teams[0] : r.teams)?.name].filter(
          (n): n is string => !!n,
        ),
        // Falls back to the driver's uuid on an unlinked/unverified Steam
        // account — this table only uses it as a React key and isn't
        // matched against anything, unlike the public leaderboards.
        steamId: rd.drivers?.steam_id ?? rd.driver_id,
        carModel: r.car_model_id != null ? accCarModelName(r.car_model_id) : null,
      })),
    )
    .sort((a, b) => a.driverName.localeCompare(b.driverName));

  if (entries.length === 0) return null;

  return {
    driverStandings: {
      [classTag]: entries.map((e, i) => ({
        position: i + 1,
        driverName: e.driverName,
        steamId: e.steamId,
        carModel: e.carModel,
        teamNames: e.teamNames,
        points: 0,
        pointsPenalty: 0,
      })),
    },
    teamStandings: {},
  };
}

// Division/tier badges (DriverTierBadge.tsx) need a batch driver lookup keyed
// by every steamId appearing across all class groups on the table being
// rendered — Emperor's standings payload itself carries no driver identity
// beyond steamId/driverName.
async function getDriverInfoForStandings(
  data: EmperorChampionshipStandings,
): Promise<Record<string, DriverInfo>> {
  // Emperor's own standings payload carries steamId "S"-prefixed (ACC's
  // native format, confirmed live) — drivers.steam_id is stored bare, so the
  // lookup (and EmperorStandingsTable's read of the result) both need it
  // stripped, unlike getEntryListAsZeroStandings's entries, which already
  // come from drivers.steam_id directly and are bare already (stripping is a
  // no-op there).
  const steamIds = Object.values(data.driverStandings).flatMap((standings) =>
    standings.map((s) => stripSteamIdPrefix(s.steamId)),
  );
  return Object.fromEntries(await getDriverInfoBySteamIds(steamIds));
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

  const roundsWithTrack = champ.schedule.filter((r) => r.emperorRawTrackName);
  const rounds = await Promise.all(
    roundsWithTrack.map(async (r) => ({
      round: r.round,
      track: r.track,
      points: await getRoundPoints(r.emperorRawTrackName!, r.emperorTrack),
    })),
  );

  return (
    <div>
      <EmperorStandingsTable
        data={result.data}
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
