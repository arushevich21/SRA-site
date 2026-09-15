import 'server-only';
import type { EmperorDriverStanding, EmperorTeamStanding } from '@sra/shared-types';
import {
  accsmTargetForDivision,
  isMultiDivision,
  roundStartsAtForDivision,
  type ChampionshipContent,
  type ScheduleRound,
} from '@/content/championships';
import { getChampionships } from '@/lib/championships-store';
import { getAccStandings } from '@/lib/emperor-standings';
import { getDriverInfoForStandings, getEntryListAsZeroStandings } from '@/lib/entry-list-standings';
import { eventInstant, hasEventTime } from '@/lib/event-time';
import { buildTeamRosters, type TeamMember } from '@/lib/team-rosters';
import type { DriverInfo } from '@/lib/driver-lookup';

// Data behind the OBS browser-source overlays (/overlay/...). Everything here
// reads the same sources the public site renders from — Emperor standings,
// the DB-backed championship schedule, the registration entry list — so a
// stream graphic can never disagree with the standings page.

// ── Which championship is on air ──────────────────────────────────────────

// The series being broadcast: an explicit ?championship=<slug> wins, else the
// running ACC division series (the GT3 Team Series — the only thing SRA
// streams today). A concluded season is skipped so the first week of a new
// season never shows last season's table.
export async function getStreamChampionship(slug?: string): Promise<ChampionshipContent | null> {
  const all = await getChampionships();
  if (slug) return all.find((c) => c.slug === slug) ?? null;
  // Anything streamable: a division series, or a single Emperor championship.
  return (
    all.find((c) => c.game === 'ACC' && isMultiDivision(c) && !c.concluded && !c.teaserOnly) ??
    all.find((c) => c.game === 'ACC' && isMultiDivision(c)) ??
    null
  );
}

// ── Which round is on air ─────────────────────────────────────────────────

// How long after its start a race night still counts as "tonight". A 60-min
// race plus qualifying, briefing and the post-race stream tail is well under
// this; the next morning it has rolled over to the following round.
const RACE_NIGHT_WINDOW_MS = 8 * 60 * 60 * 1000;

export type StreamRound = {
  round: ScheduleRound;
  // When THIS division races the round — split-night aware. Null = TBA.
  startsAt: string | null;
  isCurrent: boolean;
};

// The round the stream is (or is about to be) covering for one division: the
// first round whose race night hasn't ended, else the season's last round.
// ?round=N overrides for replays and pre-produced segments.
export function resolveStreamRound(
  champ: ChampionshipContent,
  divisionId: number | null,
  now: number,
  override?: number,
): StreamRound | null {
  const rounds = streamRounds(champ, divisionId, now);
  if (rounds.length === 0) return null;
  if (override != null) return rounds.find((r) => r.round.round === override) ?? rounds[0];
  return rounds.find((r) => r.isCurrent) ?? rounds[rounds.length - 1];
}

// Every round with its division-specific night, exactly one flagged current.
export function streamRounds(
  champ: ChampionshipContent,
  divisionId: number | null,
  now: number,
): StreamRound[] {
  const rounds = [...champ.schedule].sort((a, b) => a.round - b.round);
  const withStart = rounds.map((round) => ({
    round,
    startsAt: roundStartsAtForDivision(round, divisionId),
    isCurrent: false,
  }));
  const currentIndex = withStart.findIndex(({ startsAt }) => {
    if (!startsAt) return false;
    // A date-only round (time TBA) is treated as starting at the day's end so
    // it stays current through the whole day it's scheduled on.
    const start = hasEventTime(startsAt) ? eventInstant(startsAt) : eventInstant(`${startsAt}T23:59:00`);
    return start + RACE_NIGHT_WINDOW_MS > now;
  });
  const index = currentIndex === -1 ? withStart.length - 1 : currentIndex;
  if (index >= 0) withStart[index].isCurrent = true;
  return withStart;
}

// ── Standings for one division ────────────────────────────────────────────

export type DivisionStandings = {
  // Null for a single-grid event (LIAW) — one Emperor championship, no divisions.
  divisionId: number | null;
  divisionName: string;
  // 'live'       — Emperor has scored at least one race.
  // 'entry-list' — no race scored yet; the confirmed entry list at 0 points.
  // 'unavailable'— Emperor couldn't be reached and there's nothing to fall back to.
  source: 'live' | 'entry-list' | 'unavailable';
  drivers: EmperorDriverStanding[];
  teams: EmperorTeamStanding[];
  rosters: Map<string, TeamMember[]>;
  // Keyed by BARE steamId (see entry-list-standings.ts).
  driverInfo: Record<string, DriverInfo>;
  // Distinct championship events Emperor has scored — "After N of 8 rounds".
  roundsScored: number;
};

export async function getDivisionStandings(
  champ: ChampionshipContent,
  divisionId: number | null,
): Promise<DivisionStandings | null> {
  // A division series has one Emperor championship per division; a
  // single-grid event has exactly one for the whole thing.
  const target =
    divisionId == null
      ? champ.emperorChampionshipId
        ? { emperorChampionshipId: champ.emperorChampionshipId, divisionName: champ.classTag }
        : null
      : accsmTargetForDivision(champ, divisionId);
  if (!target) return null;

  const base = {
    divisionId,
    divisionName: target.divisionName,
    teams: [] as EmperorTeamStanding[],
    rosters: new Map<string, TeamMember[]>(),
    driverInfo: {} as Record<string, DriverInfo>,
    roundsScored: 0,
  };

  const result = await getAccStandings(target.emperorChampionshipId);
  const live = result.ok ? Object.values(result.data.driverStandings).flat() : [];

  if (live.length > 0) {
    const data = result.ok ? result.data : { driverStandings: {}, teamStandings: {} };
    const eventIds = new Set(live.flatMap((d) => Object.keys(d.eventPoints)));
    return {
      ...base,
      source: 'live',
      drivers: live.slice().sort((a, b) => a.position - b.position),
      teams: Object.values(data.teamStandings).flat().sort((a, b) => a.position - b.position),
      rosters: buildTeamRosters(data.driverStandings),
      driverInfo: await getDriverInfoForStandings(data),
      roundsScored: eventIds.size,
    };
  }

  // Nothing scored (or Emperor down): the confirmed entry list, same as the
  // standings page shows before round 1.
  const entryList =
    champ.registrationKey && champ.registrationSeason
      ? await getEntryListAsZeroStandings(
          champ.registrationKey,
          champ.registrationSeason,
          champ.classTag,
          divisionId ?? undefined,
        )
      : null;

  if (!entryList) return { ...base, source: 'unavailable', drivers: [] };

  const drivers = Object.values(entryList.driverStandings).flat();
  const rosters = buildTeamRosters(entryList.driverStandings);
  // Pre-season team table: every registered team at 0, alphabetical.
  const teams: EmperorTeamStanding[] = [...rosters.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((teamName, i) => ({ position: i + 1, teamName, points: 0, pointsPenalty: 0, droppedEventIds: [] }));

  return {
    ...base,
    source: 'entry-list',
    drivers,
    teams,
    rosters,
    driverInfo: await getDriverInfoForStandings(entryList),
  };
}

// Division ids this series actually runs, in order — the overlay's valid
// values for the /overlay/<scene>/division_N segment.
export function streamDivisionIds(champ: ChampionshipContent): number[] {
  return (champ.accsmTargets ?? []).map((t) => t.divisionId);
}
