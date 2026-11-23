import 'server-only';
import { unstable_cache } from 'next/cache';
import {
  findNemesis,
  percentileOf,
  pickArchetype,
  seasonNumbers,
  type Archetype,
  type SeasonNumbers,
  type WrappedRace,
} from '@sra/domain';
import { supabase } from '@/lib/supabase';

// PROTOTYPE data path for Season 19 Wrapped: reads live tables on request
// (cached an hour). The real feature computes once into a snapshot table —
// see the plan in the PR. Admin-only route, so the cost is bounded.

const REGISTRATION_KEY = 'acc-gt3-s19';
const SEASON = 19;

type RawCar = {
  position: number;
  lapsCompleted: number;
  totalTimeMs: number;
  currentDriverSteamId?: string;
  drivers?: { steamId: string; firstName?: string; lastName?: string }[];
};

type SessionRow = {
  championship_id: string;
  session_type: string;
  session_date: string;
  track_key: string;
  results: RawCar[];
};

export type WrappedDriverCard = {
  steamId: string;
  name: string;
  number: number | null;
  division: number;
  numbers: SeasonNumbers;
  practicePct: number;
  distanceCompare: string;
  nemesis: {
    name: string;
    number: number | null;
    sideBySide: number;
    ahead: number;
    behind: number;
    racesTogether: number;
  } | null;
  archetype: Archetype;
  /** The number behind the archetype, for the card's evidence line. */
  archetypeEvidence: string;
  roundsStarted: number;
  totalRounds: number;
};

const steamOf = (car: RawCar) => car.currentDriverSteamId ?? car.drivers?.[0]?.steamId ?? '';
const bare = (id: string) => id.replace(/^S/, '');

// Real-world yardsticks for the distance slide, short to long (approx. km).
const DISTANCES: [number, string][] = [
  [435, 'the drive from Los Angeles to Las Vegas'],
  [545, 'the drive from Toronto to Montreal'],
  [805, 'an Indianapolis 500'],
  [1270, 'the drive from New York to Chicago'],
  [1620, 'the drive from Chicago to Denver'],
  [4490, 'the drive from Los Angeles to New York'],
  [4660, 'what a Le Mans 24 Hours winner covers'],
];

export function compareDistance(km: number): string {
  let pick: [number, string] | null = null;
  for (const d of DISTANCES) if (km >= d[0]) pick = d;
  if (!pick) return `${Math.round((km / DISTANCES[0][0]) * 100)}% of ${DISTANCES[0][1]}.`;
  const ratio = km / pick[0];
  return ratio < 1.5 ? `More than ${pick[1]}.` : `${ratio.toFixed(1)}× ${pick[1]}.`;
}

async function pageAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

async function load() {
  const { data: targets, error: tErr } = await supabase
    .from('championship_accsm_targets')
    .select('emperor_championship_id, division_id')
    .eq('registration_key', REGISTRATION_KEY);
  if (tErr) throw new Error(tErr.message);
  const divisionOf = new Map((targets ?? []).map((t) => [t.emperor_championship_id as string, t.division_id as number]));

  const { data: sessions, error: sErr } = await supabase
    .from('acc_race_sessions')
    .select('championship_id, session_type, session_date, track_key, results')
    .in('championship_id', [...divisionOf.keys()])
    .in('session_type', ['Race', 'Qualify'])
    .order('session_date', { ascending: true });
  if (sErr) throw new Error(sErr.message);

  const { data: tracks } = await supabase.from('acc_tracks').select('track_key, length_m');
  const trackLengths = Object.fromEntries((tracks ?? []).map((t) => [t.track_key, t.length_m]));

  const rows = (sessions ?? []) as SessionRow[];
  const raceDates = rows.filter((r) => r.session_type === 'Race').map((r) => r.session_date);
  const from = new Date(Date.parse(raceDates[0]) - 7 * 86_400_000).toISOString();
  const to = new Date(Date.parse(raceDates[raceDates.length - 1]) + 86_400_000).toISOString();

  const ledger = await pageAll<{ steam_id: string; laps: number }>((a, b) =>
    supabase
      .from('acc_lap_ledger')
      .select('steam_id, laps, acc_lap_ledger_files!inner(session_type, session_at)')
      .eq('acc_lap_ledger_files.session_type', 'FP')
      .gte('acc_lap_ledger_files.session_at', from)
      .lte('acc_lap_ledger_files.session_at', to)
      .range(a, b),
  );
  const practice = new Map<string, number>();
  for (const l of ledger) practice.set(bare(l.steam_id), (practice.get(bare(l.steam_id)) ?? 0) + l.laps);

  const history = await pageAll<{ player_id: string; consistency: number | null }>((a, b) =>
    supabase
      .from('srating_history')
      .select('player_id, consistency')
      .eq('series', 'GT3')
      .eq('season', SEASON)
      .eq('excluded', false)
      .range(a, b),
  );
  const consistencySum = new Map<string, { sum: number; n: number }>();
  for (const h of history) {
    if (h.consistency == null) continue;
    const id = bare(h.player_id);
    const c = consistencySum.get(id) ?? { sum: 0, n: 0 };
    c.sum += h.consistency;
    c.n += 1;
    consistencySum.set(id, c);
  }

  // Per division: rounds in date order; each race paired with the qualifying
  // session that ran within six hours before it (one D1 round has none).
  // Plain arrays only below: unstable_cache JSON-serializes the result, so a Map
  // would come back as {}.
  const divisions = new Map<number, { races: WrappedRace[]; gains: [string, number[]][] }>();
  for (const [champId, division] of divisionOf) {
    const mine = rows.filter((r) => r.championship_id === champId);
    const races = mine.filter((r) => r.session_type === 'Race');
    const qualis = mine.filter((r) => r.session_type === 'Qualify');
    const gains = new Map<string, number[]>();
    const wrappedRaces: WrappedRace[] = races.map((race, i) => {
      const t = Date.parse(race.session_date);
      const q = qualis.filter((x) => Date.parse(x.session_date) <= t && t - Date.parse(x.session_date) < 6 * 3_600_000).pop();
      const qPos = new Map((q?.results ?? []).map((c) => [steamOf(c), c.position]));
      const entries = race.results
        .filter((c) => steamOf(c))
        .map((c) => {
          const id = steamOf(c);
          const qp = qPos.get(id);
          if (qp != null) (gains.get(id) ?? gains.set(id, []).get(id)!).push(qp - c.position);
          return { steamId: id, position: c.position, laps: c.lapsCompleted, totalTimeMs: c.totalTimeMs };
        });
      return { round: i + 1, trackKey: race.track_key, entries };
    });
    divisions.set(division, { races: wrappedRaces, gains: [...gains.entries()] });
  }

  // Names + numbers for everyone who raced.
  const raced = new Set<string>();
  const fileNames = new Map<string, string>();
  for (const r of rows)
    for (const c of r.results) {
      const id = steamOf(c);
      if (!id) continue;
      if (r.session_type === 'Race') raced.add(id);
      const d = c.drivers?.find((x) => x.steamId === id) ?? c.drivers?.[0];
      if (d && !fileNames.has(id)) fileNames.set(id, [d.firstName, d.lastName].filter(Boolean).join(' '));
    }
  const { data: drivers } = await supabase
    .from('drivers')
    .select('steam_id, first_name, last_name, display_name, driver_number')
    .in('steam_id', [...raced]);
  const people = new Map<string, { name: string; number: number | null }>();
  for (const id of raced) people.set(id, { name: fileNames.get(id) || id, number: null });
  for (const d of drivers ?? []) {
    const full = [d.first_name, d.last_name].filter(Boolean).join(' ').trim();
    people.set(d.steam_id, {
      name: full || (d.display_name ?? '').split('┊')[0].trim() || people.get(d.steam_id)!.name,
      number: d.driver_number,
    });
  }

  return {
    divisions: [...divisions.entries()],
    trackLengths,
    practice: [...practice.entries()],
    consistency: [...consistencySum.entries()].map(([k, v]) => [k, v.sum / v.n] as const),
    people: [...people.entries()],
  };
}

const loadCached = unstable_cache(load, ['wrapped-s19-prototype-v2'], { revalidate: 3600 });

export type WrappedRosterEntry = { steamId: string; name: string; division: number };

export async function getS19Wrapped(steamId: string | null): Promise<{
  roster: WrappedRosterEntry[];
  card: WrappedDriverCard | null;
}> {
  const data = await loadCached();
  const people = new Map(data.people);
  const practice = new Map(data.practice);
  const consistency = new Map(data.consistency);

  const divisionOf = new Map<string, number>();
  for (const [div, d] of data.divisions)
    for (const r of d.races) for (const e of r.entries) if (!divisionOf.has(e.steamId)) divisionOf.set(e.steamId, div);

  const roster = [...divisionOf.entries()]
    .map(([id, division]) => ({ steamId: id, name: people.get(id)?.name ?? id, division }))
    .sort((a, b) => a.division - b.division || a.name.localeCompare(b.name));

  if (!steamId || !divisionOf.has(steamId)) return { roster, card: null };

  const division = divisionOf.get(steamId)!;
  const divRaw = data.divisions.find(([d]) => d === division)![1];
  const div = { races: divRaw.races, gains: new Map(divRaw.gains) };
  const divIds = roster.filter((r) => r.division === division).map((r) => r.steamId);

  const numbers = seasonNumbers(steamId, div.races, data.trackLengths, practice.get(steamId) ?? 0);
  const leaguePractice = roster.map((r) => practice.get(r.steamId) ?? 0);
  const practicePct = percentileOf(numbers.practiceLaps, leaguePractice);

  const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const avgGain = (id: string) => {
    const g = div.gains.get(id) ?? [];
    return g.length >= 3 ? avg(g) : null;
  };
  const divGains = divIds.map(avgGain).filter((x): x is number => x != null);
  const myGain = avgGain(steamId);
  const divConsistency = divIds.map((id) => consistency.get(id)).filter((x): x is number => x != null);
  const myConsistency = consistency.get(steamId);

  const roundsStarted = numbers.races;
  const totalRounds = div.races.length;
  const archetype = pickArchetype({
    roundsStarted,
    totalRounds,
    consistencyPct: myConsistency != null ? percentileOf(myConsistency, divConsistency) : 0,
    gainPct: myGain != null ? percentileOf(myGain, divGains) : 0,
    lossPct: myGain != null ? percentileOf(-myGain, divGains.map((g) => -g)) : 0,
    practicePct,
  });

  const evidence: Record<string, string> = {
    metronome: `Consistency rating ${Math.round((myConsistency ?? 0) * 100)}/100 — top ${Math.max(1, Math.round((1 - percentileOf(myConsistency ?? 0, divConsistency)) * 100))}% of Division ${division}`,
    grinder: `${numbers.practiceLaps.toLocaleString('en-US')} practice laps — more than ${Math.round(practicePct * 100)}% of the league`,
    charger: `+${(myGain ?? 0).toFixed(1)} places per race, qualifying to flag`,
    qualifier: `${(myGain ?? 0).toFixed(1)} places per race, qualifying to flag`,
    ironman: `${roundsStarted} of ${totalRounds} rounds started`,
    racer: `${roundsStarted} of ${totalRounds} rounds started`,
  };

  const n = findNemesis(steamId, div.races);
  const me = people.get(steamId);
  return {
    roster,
    card: {
      steamId,
      name: me?.name ?? steamId,
      number: me?.number ?? null,
      division,
      numbers,
      practicePct,
      distanceCompare: compareDistance(numbers.km),
      nemesis: n
        ? {
            name: people.get(n.steamId)?.name ?? n.steamId,
            number: people.get(n.steamId)?.number ?? null,
            sideBySide: n.sideBySide,
            ahead: n.ahead,
            behind: n.behind,
            racesTogether: n.racesTogether,
          }
        : null,
      archetype,
      archetypeEvidence: evidence[archetype.key],
      roundsStarted,
      totalRounds,
    },
  };
}
