import 'server-only';
import { unstable_cache } from 'next/cache';
import type { EmperorDriverStanding } from '@sra/shared-types';
import { supabase } from '@/lib/supabase';
import { getAccStandings } from '@/lib/emperor-standings';

// Champions of a finished multi-division season, per division: the drivers'
// championship (the overall table — SRA's Gold championship), the Silver
// championship, and the teams' championship. Standings come from Emperor —
// it computes the championship, we display it (drop rounds and penalties
// included). Wins, podiums, each driver's car and race number come from our
// stored race results; names, photos and tiers from drivers.

export type ChampionDriver = {
  steamId: string;
  name: string;
  number: number | null;
  photoUrl: string | null;
  carModelId: number | null;
};

export type DriverTitle = ChampionDriver & {
  points: number;
  /** Over P2 of the same championship (the next Silver driver, for Silver). */
  margin: number;
  wins: number;
  podiums: number;
  races: number;
  teamName: string | null;
  /** Position in the division's overall table. */
  overallPosition: number;
};

export type DivisionChampions = {
  division: number;
  driver: DriverTitle;
  silver: DriverTitle | null;
  team: {
    name: string;
    points: number;
    margin: number;
    wins: number;
    drivers: ChampionDriver[];
  } | null;
};

const bare = (id: string) => id.replace(/^S/, '');

async function divisionTargets(registrationKey: string) {
  const { data, error } = await supabase
    .from('championship_accsm_targets')
    .select('emperor_championship_id, division_id')
    .eq('registration_key', registrationKey)
    .order('division_id');
  if (error) throw new Error(error.message);
  return (data ?? []).map((t) => ({ champId: t.emperor_championship_id as string, division: t.division_id as number }));
}

// One division's champions. Cached per division, so a single graphic costs
// one ACCSM request (it rate-limits 5 per 20s per IP — fetching all four
// divisions for every graphic tripped it).
async function loadDivision(registrationKey: string, division: number): Promise<DivisionChampions | null> {
  const target = (await divisionTargets(registrationKey)).find((t) => t.division === division);
  if (!target) return null;

  const res = await getAccStandings(target.champId);
  if (!res.ok) throw new Error(`Standings for division ${division}: ${res.error}`);
  // Already SRA-scored: team totals are re-scored with each driver's own
  // drop round (applyIndividualTeamDrops inside getAccStandings), and points
  // are net of penalties — the same figures the standings page shows.
  const drivers = Object.values(res.data.driverStandings).flat().sort((a, b) => a.position - b.position);
  const teams = Object.values(res.data.teamStandings).flat().sort((a, b) => a.position - b.position);
  if (drivers.length === 0) return null;

  const { data: sessions } = await supabase
    .from('acc_race_sessions')
    .select('results')
    .eq('championship_id', target.champId)
    .eq('session_type', 'Race');
  const finishes = new Map<string, number[]>();
  const cars = new Map<string, Map<number, number>>();
  const raceNumbers = new Map<string, Map<number, number>>();
  const tally = (m: Map<string, Map<number, number>>, id: string, v: number) => {
    const c = m.get(id) ?? m.set(id, new Map()).get(id)!;
    c.set(v, (c.get(v) ?? 0) + 1);
  };
  for (const s of sessions ?? []) {
    for (const car of s.results as {
      position: number;
      carModel?: number;
      raceNumber?: number;
      currentDriverSteamId?: string;
      drivers?: { steamId: string }[];
    }[]) {
      const id = car.currentDriverSteamId ?? car.drivers?.[0]?.steamId;
      if (!id) continue;
      (finishes.get(id) ?? finishes.set(id, []).get(id)!).push(car.position);
      if (car.carModel != null) tally(cars, id, car.carModel);
      if (car.raceNumber != null && car.raceNumber > 0) tally(raceNumbers, id, car.raceNumber);
    }
  }
  const mostUsed = (m: Map<number, number> | undefined) =>
    m && m.size > 0 ? [...m.entries()].sort((a, b) => b[1] - a[1])[0][0] : null;

  const { data: rows } = await supabase
    .from('drivers')
    .select('steam_id, first_name, last_name, display_name, driver_number, photo_url, tier')
    .in('steam_id', drivers.map((d) => bare(d.steamId)));
  const row = (steamId: string) => rows?.find((x) => x.steam_id === steamId);

  const person = (steamId: string, fallbackName: string): ChampionDriver => {
    const r = row(steamId);
    const full = r ? [r.first_name, r.last_name].filter(Boolean).join(' ').trim() : '';
    return {
      steamId,
      name: full || fallbackName,
      // The number they raced that season, not today's profile number: a
      // champion now runs #1 (and anyone can change number between seasons),
      // but a season's graphic shows what was on the car that season.
      number: mostUsed(raceNumbers.get(steamId)) ?? r?.driver_number ?? null,
      photoUrl: r?.photo_url ?? null,
      carModelId: mostUsed(cars.get(steamId)),
    };
  };

  const title = (field: EmperorDriverStanding[]): DriverTitle | null => {
    const [first, second] = field;
    if (!first) return null;
    const id = bare(first.steamId);
    const f = finishes.get(id) ?? [];
    return {
      ...person(id, first.driverName),
      points: first.points,
      margin: second ? first.points - second.points : first.points,
      wins: f.filter((p) => p === 1).length,
      podiums: f.filter((p) => p <= 3).length,
      races: f.length,
      teamName: first.teamNames[0] ?? null,
      overallPosition: first.position,
    };
  };

  // Silver: the same rule as the standings page's Silver view
  // (filterAndRankByTier) — Silver-tier drivers only, in overall order, same
  // points. A driver with no drivers row has no tier and is in neither.
  const silverField = drivers.filter((d) => row(bare(d.steamId))?.tier === 'silver');

  const teamName = teams[0]?.teamName ?? null;
  const teamSteamIds = teamName
    ? drivers.filter((d) => d.teamNames.includes(teamName)).map((d) => bare(d.steamId))
    : [];

  return {
    division,
    driver: title(drivers)!,
    silver: title(silverField),
    team: teamName
      ? {
          name: teamName,
          points: teams[0].points,
          margin: teams[1] ? teams[0].points - teams[1].points : teams[0].points,
          wins: teamSteamIds.reduce((n, id) => n + (finishes.get(id) ?? []).filter((p) => p === 1).length, 0),
          drivers: teamSteamIds.map((id) =>
            person(id, drivers.find((d) => bare(d.steamId) === id)?.driverName ?? id),
          ),
        }
      : null,
  };
}

// A finished season doesn't change; a day's cache keeps ACCSM out of it.
export const getDivisionChampions = unstable_cache(loadDivision, ['division-champions-v2'], { revalidate: 86_400 });

/** Every division's champions, in division order. Sequential: one ACCSM call at a time. */
export async function getSeasonChampions(registrationKey: string): Promise<DivisionChampions[]> {
  const out: DivisionChampions[] = [];
  for (const t of await divisionTargets(registrationKey)) {
    const c = await getDivisionChampions(registrationKey, t.division);
    if (c) out.push(c);
  }
  return out;
}
