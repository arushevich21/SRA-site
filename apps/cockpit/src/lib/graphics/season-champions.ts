import 'server-only';
import { unstable_cache } from 'next/cache';
import { supabase } from '@/lib/supabase';
import { getAccStandings } from '@/lib/emperor-standings';

// Champions of a finished multi-division season (drivers' and teams' titles
// per division), for the champion graphics. Standings come from Emperor —
// it computes the championship, we display it (drop rounds and penalties
// included). Wins, podiums and each driver's car come from our stored race
// results; names, numbers and photos from drivers.

export type ChampionDriver = {
  steamId: string;
  name: string;
  number: number | null;
  photoUrl: string | null;
  carModelId: number | null;
};

export type DivisionChampions = {
  division: number;
  driver: ChampionDriver & {
    points: number;
    margin: number;
    wins: number;
    podiums: number;
    races: number;
    teamName: string | null;
  };
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
  const champId = target.champId;
  {
    const res = await getAccStandings(champId);
    if (!res.ok) throw new Error(`Standings for division ${division}: ${res.error}`);
    // Already SRA-scored: team totals are re-scored with each driver's own
    // drop round (applyIndividualTeamDrops inside getAccStandings), and
    // points are net of penalties — the same figures the standings page shows.
    const drivers = Object.values(res.data.driverStandings).flat().sort((a, b) => a.position - b.position);
    const teams = Object.values(res.data.teamStandings).flat().sort((a, b) => a.position - b.position);
    if (drivers.length === 0) return null;

    const { data: sessions } = await supabase
      .from('acc_race_sessions')
      .select('results')
      .eq('championship_id', champId)
      .eq('session_type', 'Race');
    const finishes = new Map<string, number[]>();
    const cars = new Map<string, Map<number, number>>();
    const raceNumbers = new Map<string, Map<number, number>>();
    for (const s of sessions ?? []) {
      for (const car of s.results as { position: number; carModel?: number; raceNumber?: number; currentDriverSteamId?: string; drivers?: { steamId: string }[] }[]) {
        const id = car.currentDriverSteamId ?? car.drivers?.[0]?.steamId;
        if (!id) continue;
        (finishes.get(id) ?? finishes.set(id, []).get(id)!).push(car.position);
        if (car.carModel != null) {
          const c = cars.get(id) ?? cars.set(id, new Map()).get(id)!;
          c.set(car.carModel, (c.get(car.carModel) ?? 0) + 1);
        }
        if (car.raceNumber != null && car.raceNumber > 0) {
          const n = raceNumbers.get(id) ?? raceNumbers.set(id, new Map()).get(id)!;
          n.set(car.raceNumber, (n.get(car.raceNumber) ?? 0) + 1);
        }
      }
    }
    const mostUsed = (m: Map<number, number> | undefined) =>
      m && m.size > 0 ? [...m.entries()].sort((a, b) => b[1] - a[1])[0][0] : null;
    const mainCar = (id: string) => mostUsed(cars.get(id));
    // The number they raced that season, not today's profile number: a
    // champion now runs #1 (and anyone can change number between seasons),
    // but the S19 graphic should show what was on the car in S19.

    const champ = drivers[0];
    const teamName = teams[0]?.teamName ?? null;
    const teamSteamIds = teamName
      ? drivers.filter((d) => d.teamNames.includes(teamName)).map((d) => bare(d.steamId))
      : [];
    const ids = [...new Set([bare(champ.steamId), ...teamSteamIds])];
    const { data: rows } = await supabase
      .from('drivers')
      .select('steam_id, first_name, last_name, display_name, driver_number, photo_url')
      .in('steam_id', ids);
    const person = (steamId: string, fallbackName: string): ChampionDriver => {
      const r = rows?.find((x) => x.steam_id === steamId);
      const full = r ? [r.first_name, r.last_name].filter(Boolean).join(' ').trim() : '';
      return {
        steamId,
        name: full || fallbackName,
        number: mostUsed(raceNumbers.get(steamId)) ?? r?.driver_number ?? null,
        photoUrl: r?.photo_url ?? null,
        carModelId: mainCar(steamId),
      };
    };

    const champId_ = bare(champ.steamId);
    const champFinishes = finishes.get(champId_) ?? [];
    return {
      division,
      driver: {
        ...person(champId_, champ.driverName),
        points: champ.points,
        margin: drivers[1] ? champ.points - drivers[1].points : champ.points,
        wins: champFinishes.filter((p) => p === 1).length,
        podiums: champFinishes.filter((p) => p <= 3).length,
        races: champFinishes.length,
        teamName: champ.teamNames[0] ?? null,
      },
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
}

// A finished season doesn't change; a day's cache keeps ACCSM out of it.
export const getDivisionChampions = unstable_cache(loadDivision, ['division-champions-v1'], { revalidate: 86_400 });

/** Every division's champions, in division order. Sequential: one ACCSM call at a time. */
export async function getSeasonChampions(registrationKey: string): Promise<DivisionChampions[]> {
  const out: DivisionChampions[] = [];
  for (const t of await divisionTargets(registrationKey)) {
    const c = await getDivisionChampions(registrationKey, t.division);
    if (c) out.push(c);
  }
  return out;
}
