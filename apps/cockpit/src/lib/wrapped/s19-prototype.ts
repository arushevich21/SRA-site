import 'server-only';
import { unstable_cache } from 'next/cache';
import {
  findNemesis,
  percentileOf,
  pickArchetype,
  seasonNumbers,
  finishTrend,
  finishSpread,
  type ArchetypeKey,
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
  raceNumber?: number;
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
  /** Season strip: every round in order; position null = didn't start. */
  rounds: { round: number; code: string; track: string; position: number | null; field: number }[];
  /** Rivalry chart: both finishing positions per round (null = not classified). */
  rivalry: { round: number; code: string; me: number | null; them: number | null }[];
  /** Field plot behind the archetype: everyone's value, the driver's own marked. */
  field: { label: string; values: number[]; mine: number; higherIsBetter: boolean };
};

// Three-letter circuit codes for the season strip, F1-graphics style.
const TRACK_CODES: Record<string, string> = {
  barcelona: 'BCN', brands_hatch: 'BRH', cota: 'COA', donington: 'DON', hungaroring: 'HUN',
  imola: 'IMO', indianapolis: 'IND', kyalami: 'KYA', laguna_seca: 'LAG', misano: 'MIS',
  monza: 'MON', mount_panorama: 'BAT', nurburgring: 'NÜR', oulton_park: 'OUL', paul_ricard: 'PRI',
  red_bull_ring: 'RBR', silverstone: 'SIL', snetterton: 'SNE', spa: 'SPA', suzuka: 'SUZ',
  valencia: 'VAL', watkins_glen: 'WGI', zandvoort: 'ZAN', zolder: 'ZOL',
};
const trackCode = (key: string) => TRACK_CODES[key] ?? key.slice(0, 3).toUpperCase();
// What drivers call the circuit, where that differs from the key.
const TRACK_NAMES: Record<string, string> = {
  mount_panorama: 'Bathurst', cota: 'COTA', spa: 'Spa', nurburgring: 'Nürburgring',
};
const trackName = (key: string) =>
  TRACK_NAMES[key] ?? key.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

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
  // The number on the car in S19 (most-used race number), not today's
  // profile number — the S19 champion has since moved to #1.
  const raceNumbers = new Map<string, Map<number, number>>();
  for (const r of rows)
    for (const c of r.results) {
      const id = steamOf(c);
      if (!id) continue;
      if (r.session_type === 'Race') {
        raced.add(id);
        if (c.raceNumber != null && c.raceNumber > 0) {
          const m = raceNumbers.get(id) ?? raceNumbers.set(id, new Map()).get(id)!;
          m.set(c.raceNumber, (m.get(c.raceNumber) ?? 0) + 1);
        }
      }
      const d = c.drivers?.find((x) => x.steamId === id) ?? c.drivers?.[0];
      if (d && !fileNames.has(id)) fileNames.set(id, [d.firstName, d.lastName].filter(Boolean).join(' '));
    }
  const seasonNumber = (id: string) => {
    const m = raceNumbers.get(id);
    return m && m.size ? [...m.entries()].sort((a, b) => b[1] - a[1])[0][0] : null;
  };
  const { data: drivers } = await supabase
    .from('drivers')
    .select('steam_id, first_name, last_name, display_name, driver_number')
    .in('steam_id', [...raced]);
  const people = new Map<string, { name: string; number: number | null }>();
  for (const id of raced) people.set(id, { name: fileNames.get(id) || id, number: seasonNumber(id) });
  for (const d of drivers ?? []) {
    const full = [d.first_name, d.last_name].filter(Boolean).join(' ').trim();
    people.set(d.steam_id, {
      name: full || (d.display_name ?? '').split('┊')[0].trim() || people.get(d.steam_id)!.name,
      number: seasonNumber(d.steam_id) ?? d.driver_number,
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

const loadCached = unstable_cache(load, ['wrapped-s19-prototype-v4'], { revalidate: 3600 });

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
  const positionsOf = (id: string) =>
    div.races.map((race) => race.entries.find((e) => e.steamId === id)?.position ?? null);
  const finishesOf = (id: string) => positionsOf(id).filter((p): p is number => p != null);
  const avgGain = (id: string) => {
    const g = div.gains.get(id) ?? [];
    return g.length >= 3 ? avg(g) : null;
  };

  // Every trait, as a "natural" stat (what the card shows) and a direction:
  // the archetype percentile is "how much MORE of this trait than the rest of
  // the division". Everything is judged within the driver's own division.
  type TraitKey = Exclude<ArchetypeKey, 'racer'>;
  const TRAITS: Record<TraitKey, { stat: (id: string) => number | null; more: 1 | -1; label: string }> = {
    frontrunner: {
      stat: (id) => (finishesOf(id).length >= 3 ? avg(finishesOf(id)) : null),
      more: -1,
      label: `Average finishing position, Division ${division}`,
    },
    metronome: { stat: (id) => consistency.get(id) ?? null, more: 1, label: `Consistency rating, Division ${division}` },
    charger: { stat: avgGain, more: 1, label: `Places gained per race from qualifying, Division ${division}` },
    qualifier: { stat: avgGain, more: -1, label: `Places gained per race from qualifying, Division ${division}` },
    bloomer: { stat: (id) => finishTrend(positionsOf(id)), more: 1, label: `Places better in the second half, Division ${division}` },
    wildcard: { stat: (id) => finishSpread(positionsOf(id)), more: 1, label: `Spread of finishing positions, Division ${division}` },
    grinder: { stat: (id) => (divisionOf.get(id) === division ? (practice.get(id) ?? 0) : null), more: 1, label: `Practice laps, Division ${division}` },
  };
  const traitData = Object.fromEntries(
    (Object.keys(TRAITS) as TraitKey[]).map((k) => {
      const t = TRAITS[k];
      const group = divIds.map(t.stat).filter((x): x is number => x != null);
      const mine = t.stat(steamId);
      const pct = mine != null ? percentileOf(mine * t.more, group.map((x) => x * t.more)) : undefined;
      // Rank within the division on this trait: 1 = the most of it.
      const rank = mine != null ? 1 + group.filter((x) => x * t.more > mine * t.more).length : null;
      return [k, { group, mine, pct, rank }];
    }),
  ) as Record<TraitKey, { group: number[]; mine: number | null; pct: number | undefined; rank: number | null }>;

  const roundsStarted = numbers.races;
  const totalRounds = div.races.length;
  const archetype = pickArchetype({
    racesStarted: roundsStarted,
    traits: Object.fromEntries((Object.keys(traitData) as TraitKey[]).map((k) => [k, traitData[k].pct])),
  });

  const evidenceFor = (k: ArchetypeKey): string => {
    if (k === 'racer') return `${roundsStarted} of ${totalRounds} rounds started`;
    const { mine, rank, group } = traitData[k];
    const of = `${rank} of ${group.length} in Division ${division}`;
    const m = mine ?? 0;
    switch (k) {
      case 'frontrunner': return `Average finish of P${m.toFixed(1)}, ${of}`;
      case 'metronome': return `Consistency rating of ${Math.round(m * 100)}, ${of}`;
      case 'charger': return `${m >= 0 ? '+' : ''}${m.toFixed(1)} places a race from qualifying, ${of}`;
      case 'qualifier': return `Qualified ${Math.abs(m).toFixed(1)} places ahead of where you finished, ${of}`;
      case 'bloomer': return `${m.toFixed(1)} places better in the second half, ${of}`;
      case 'wildcard': {
        const f = finishesOf(steamId);
        return `Finishes anywhere from P${Math.min(...f)} to P${Math.max(...f)}, ${of}`;
      }
      case 'grinder': return `${Math.round(m).toLocaleString('en-US')} practice laps, ${of}`;
    }
  };
  const evidence = { [archetype.key]: evidenceFor(archetype.key) };

  const n = findNemesis(steamId, div.races);
  const me = people.get(steamId);

  const posIn = (race: WrappedRace, id: string) => race.entries.find((e) => e.steamId === id)?.position ?? null;
  const rounds = div.races.map((race) => ({
    round: race.round,
    code: trackCode(race.trackKey),
    track: trackName(race.trackKey),
    position: posIn(race, steamId),
    field: race.entries.length,
  }));
  const rivalry = n
    ? div.races.map((race) => ({
        round: race.round,
        code: trackCode(race.trackKey),
        me: posIn(race, steamId),
        them: posIn(race, n.steamId),
      }))
    : [];

  // The stat the archetype was judged on, against the same group. The Racer
  // wasn't judged on anything, so it shows average finish.
  const fieldKey: TraitKey = archetype.key === 'racer' ? 'frontrunner' : archetype.key;
  const field: WrappedDriverCard['field'] = {
    label: TRAITS[fieldKey].label,
    values: traitData[fieldKey].group,
    mine: traitData[fieldKey].mine ?? 0,
    higherIsBetter: TRAITS[fieldKey].more === 1,
  };
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
      rounds,
      rivalry,
      field,
    },
  };
}
