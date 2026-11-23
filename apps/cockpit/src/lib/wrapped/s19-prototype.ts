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
  type WrappedRace,
} from '@sra/domain';
import { supabase } from '@/lib/supabase';
import type { EasterEgg, WrappedDriverCard, WrappedRosterEntry } from './card';

export type { EasterEgg, WrappedDriverCard, WrappedRosterEntry } from './card';

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
  carModel?: number;
  sectorsMs?: number[];
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

// Three-letter circuit codes for the season strip, F1-graphics style.
const TRACK_CODES: Record<string, string> = {
  barcelona: 'BCN',
  brands_hatch: 'BRH',
  cota: 'COA',
  donington: 'DON',
  hungaroring: 'HUN',
  imola: 'IMO',
  indianapolis: 'IND',
  kyalami: 'KYA',
  laguna_seca: 'LAG',
  misano: 'MIS',
  monza: 'MON',
  mount_panorama: 'BAT',
  nurburgring: 'NÜR',
  oulton_park: 'OUL',
  paul_ricard: 'PRI',
  red_bull_ring: 'RBR',
  silverstone: 'SIL',
  snetterton: 'SNE',
  spa: 'SPA',
  suzuka: 'SUZ',
  valencia: 'VAL',
  watkins_glen: 'WGI',
  zandvoort: 'ZAN',
  zolder: 'ZOL',
};
const trackCode = (key: string) => TRACK_CODES[key] ?? key.slice(0, 3).toUpperCase();
// What drivers call the circuit, where that differs from the key.
const TRACK_NAMES: Record<string, string> = {
  mount_panorama: 'Bathurst',
  cota: 'COTA',
  spa: 'Spa',
  nurburgring: 'Nürburgring',
};
const trackName = (key: string) =>
  TRACK_NAMES[key] ??
  key
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');

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
  build: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
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
  const divisionOf = new Map(
    (targets ?? []).map((t) => [t.emperor_championship_id as string, t.division_id as number])
  );

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

  // Practice laps, in two plain steps: the season's practice files, then the
  // ledger rows for those files. Not an embedded `!inner` filter — PostgREST
  // turns that into a per-row lateral over the whole 400k-row ledger, which
  // ran into the 8s statement timeout on a cold cache.
  const files = await pageAll<{ id: number; session_at: string }>((a, b) =>
    supabase
      .from('acc_lap_ledger_files')
      .select('id, session_at')
      .eq('session_type', 'FP')
      .gte('session_at', from)
      .lte('session_at', to)
      .order('id')
      .range(a, b)
  );
  const fileDay = new Map(files.map((f) => [f.id, f.session_at.slice(0, 10)]));
  const fileIds = [...fileDay.keys()];
  const ledger: { file_id: number; steam_id: string; laps: number }[] = [];
  for (let i = 0; i < fileIds.length; i += 300) {
    const chunk = fileIds.slice(i, i + 300);
    ledger.push(
      ...(await pageAll<{ file_id: number; steam_id: string; laps: number }>((a, b) =>
        supabase
          .from('acc_lap_ledger')
          .select('file_id, steam_id, laps')
          .in('file_id', chunk)
          // A stable order over the key, or pages can overlap/skip rows.
          .order('file_id')
          .order('steam_id')
          .order('car_model_id')
          .range(a, b)
      ))
    );
  }
  const practice = new Map<string, number>();
  const practiceDays = new Map<string, Set<string>>();
  for (const l of ledger) {
    const id = bare(l.steam_id);
    practice.set(id, (practice.get(id) ?? 0) + l.laps);
    const day = fileDay.get(l.file_id);
    if (day) (practiceDays.get(id) ?? practiceDays.set(id, new Set()).get(id)!).add(day);
  }
  const seasonDays = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

  // Sweatshop: the season's laps on the hot-lap servers (seasonal board),
  // same source and sum as the Sweatshop leaderboard.
  const sweatRows = await pageAll<{ steam_id: string; driver_name: string; total_laps: number }>(
    (a, b) =>
      supabase
        .from('acc_hotlap_leaderboard')
        .select('steam_id, driver_name, total_laps')
        .eq('board_scope', 'seasonal')
        .eq('season', `S${SEASON}`)
        .order('track_key')
        .order('car_model_id')
        .order('steam_id')
        .order('is_wet')
        .range(a, b)
  );
  const sweat = new Map<string, { laps: number; name: string }>();
  for (const r of sweatRows) {
    const id = bare(r.steam_id);
    const cur = sweat.get(id) ?? { laps: 0, name: r.driver_name };
    cur.laps += r.total_laps;
    sweat.set(id, cur);
  }

  const history = await pageAll<{
    player_id: string;
    event: number;
    consistency: number | null;
    composite: number | null;
  }>((a, b) =>
    supabase
      .from('srating_history')
      .select('player_id, event, consistency, composite')
      .eq('series', 'GT3')
      .eq('season', SEASON)
      .eq('excluded', false)
      .order('id')
      .range(a, b)
  );
  const consistencySum = new Map<string, { sum: number; n: number }>();
  const ratings = new Map<string, [number, number][]>(); // steam -> [event, composite]
  for (const h of history) {
    const id = bare(h.player_id);
    if (h.composite != null)
      (ratings.get(id) ?? ratings.set(id, []).get(id)!).push([h.event, Number(h.composite)]);
    if (h.consistency == null) continue;
    const c = consistencySum.get(id) ?? { sum: 0, n: 0 };
    c.sum += h.consistency;
    c.n += 1;
    consistencySum.set(id, c);
  }

  // Teams: the S19 entry lineup (registrations → registration_drivers), the
  // authoritative per-event roster; team_members is barely populated for S19.
  const regRows = await pageAll<{
    id: string;
    teams: { name: string } | { name: string }[] | null;
    registration_drivers: {
      drivers: { steam_id: string | null } | { steam_id: string | null }[] | null;
    }[];
  }>((a, b) =>
    supabase
      .from('registrations')
      .select('id, teams(name), registration_drivers(drivers(steam_id))')
      .eq('championship_key', REGISTRATION_KEY)
      .not('team_id', 'is', null)
      .order('id')
      .range(a, b)
  );
  const one = <T>(x: T | T[] | null): T | null => (Array.isArray(x) ? (x[0] ?? null) : x);
  const teamMap = new Map<string, Set<string>>();
  for (const r of regRows) {
    const name = one(r.teams)?.name;
    if (!name) continue;
    const set = teamMap.get(name) ?? teamMap.set(name, new Set()).get(name)!;
    for (const rd of r.registration_drivers ?? []) {
      const steam = one(rd.drivers)?.steam_id;
      if (steam) set.add(steam);
    }
  }
  const teams: [string, string[]][] = [...teamMap.entries()].map(([n, ids]) => [n, [...ids]]);

  // Stewarding: penalty points and warnings per driver per round.
  const stw = await pageAll<{
    driver_id: string;
    round: number;
    pp: number;
    warnings: number;
    q_warnings: number;
  }>((a, b) =>
    supabase
      .from('stw_ledger')
      .select('driver_id, round, pp, warnings, q_warnings')
      .eq('series', 'GT3')
      .eq('season', SEASON)
      .order('driver_id')
      .order('round')
      .range(a, b)
  );

  // Per division: rounds in date order; each race paired with the qualifying
  // session that ran within six hours before it (one D1 round has none).
  // Plain arrays only below: unstable_cache JSON-serializes the result, so a Map
  // would come back as {}.
  const divisions = new Map<
    number,
    {
      races: WrappedRace[];
      gains: [string, number[]][];
      /** Per round (index = round - 1): qualifying positions and best-lap sectors. */
      quali: [string, number][][];
      sectors: [string, number[]][][];
    }
  >();
  for (const [champId, division] of divisionOf) {
    const mine = rows.filter((r) => r.championship_id === champId);
    const races = mine.filter((r) => r.session_type === 'Race');
    const qualis = mine.filter((r) => r.session_type === 'Qualify');
    const gains = new Map<string, number[]>();
    const qualiByRound: [string, number][][] = [];
    const sectorsByRound: [string, number[]][][] = [];
    const wrappedRaces: WrappedRace[] = races.map((race, i) => {
      const t = Date.parse(race.session_date);
      const q = qualis
        .filter(
          (x) => Date.parse(x.session_date) <= t && t - Date.parse(x.session_date) < 6 * 3_600_000
        )
        .pop();
      const qPos = new Map((q?.results ?? []).map((c) => [steamOf(c), c.position]));
      qualiByRound.push([...qPos.entries()].filter(([id]) => id));
      sectorsByRound.push(
        race.results
          .filter(
            (c) =>
              steamOf(c) &&
              Array.isArray(c.sectorsMs) &&
              c.sectorsMs.length === 3 &&
              c.sectorsMs.every((x) => x > 0)
          )
          .map((c) => [steamOf(c), c.sectorsMs!])
      );
      const entries = race.results
        .filter((c) => steamOf(c))
        .map((c) => {
          const id = steamOf(c);
          const qp = qPos.get(id);
          if (qp != null) (gains.get(id) ?? gains.set(id, []).get(id)!).push(qp - c.position);
          return {
            steamId: id,
            position: c.position,
            laps: c.lapsCompleted,
            totalTimeMs: c.totalTimeMs,
          };
        });
      return { round: i + 1, trackKey: race.track_key, entries };
    });
    divisions.set(division, {
      races: wrappedRaces,
      gains: [...gains.entries()],
      quali: qualiByRound,
      sectors: sectorsByRound,
    });
  }

  // Names + numbers for everyone who raced.
  const raced = new Set<string>();
  const fileNames = new Map<string, string>();
  // The number on the car in S19 (most-used race number), not today's
  // profile number — the S19 champion has since moved to #1.
  const raceNumbers = new Map<string, Map<number, number>>();
  const carModels = new Map<string, Map<number, number>>();
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
        if (c.carModel != null) {
          const m = carModels.get(id) ?? carModels.set(id, new Map()).get(id)!;
          m.set(c.carModel, (m.get(c.carModel) ?? 0) + 1);
        }
      }
      const d = c.drivers?.find((x) => x.steamId === id) ?? c.drivers?.[0];
      if (d && !fileNames.has(id))
        fileNames.set(id, [d.firstName, d.lastName].filter(Boolean).join(' '));
    }
  const seasonNumber = (id: string) => {
    const m = raceNumbers.get(id);
    return m && m.size ? [...m.entries()].sort((a, b) => b[1] - a[1])[0][0] : null;
  };
  const { data: drivers } = await supabase
    .from('drivers')
    .select('id, steam_id, first_name, last_name, display_name, driver_number')
    .in('steam_id', [...raced]);
  const steamByDriverId = new Map(
    (drivers ?? []).map((d) => [d.id as string, d.steam_id as string])
  );
  const stewarding = new Map<string, [number, number, number][]>(); // steam -> [round, pp, warnings]
  for (const r of stw) {
    const id = steamByDriverId.get(r.driver_id);
    if (!id) continue;
    (stewarding.get(id) ?? stewarding.set(id, []).get(id)!).push([
      r.round,
      r.pp,
      r.warnings + r.q_warnings,
    ]);
  }
  const people = new Map<string, { name: string; number: number | null }>();
  for (const id of raced)
    people.set(id, { name: fileNames.get(id) || id, number: seasonNumber(id) });
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
    driverIds: [...steamByDriverId.entries()].map(
      ([driverId, steam]) => [steam, driverId] as const
    ),
    ratings: [...ratings.entries()],
    teams,
    stewarding: [...stewarding.entries()],
    practiceDays: [...practiceDays.entries()].map(([id, d]) => [id, d.size] as const),
    seasonDays,
    sweatTop: [...sweat.entries()].sort((a, b) => b[1].laps - a[1].laps).slice(0, 2),
    // Each driver's main car (most races in it), as [steamId, model, races].
    cars: [...carModels.entries()].map(([id, m]) => {
      const [model, races] = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
      return [id, model, races] as const;
    }),
  };
}

const loadCached = unstable_cache(load, ['wrapped-s19-prototype-v9'], { revalidate: 3600 });

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
    for (const r of d.races)
      for (const e of r.entries) if (!divisionOf.has(e.steamId)) divisionOf.set(e.steamId, div);

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
  const TRAITS: Record<
    TraitKey,
    { stat: (id: string) => number | null; more: 1 | -1; label: string }
  > = {
    frontrunner: {
      stat: (id) => (finishesOf(id).length >= 3 ? avg(finishesOf(id)) : null),
      more: -1,
      label: `Average finishing position, Division ${division}`,
    },
    metronome: {
      stat: (id) => consistency.get(id) ?? null,
      more: 1,
      label: `Consistency rating, Division ${division}`,
    },
    charger: {
      stat: avgGain,
      more: 1,
      label: `Places gained per race from qualifying, Division ${division}`,
    },
    qualifier: {
      stat: avgGain,
      more: -1,
      label: `Places gained per race from qualifying, Division ${division}`,
    },
    bloomer: {
      stat: (id) => finishTrend(positionsOf(id)),
      more: 1,
      label: `Places better in the second half, Division ${division}`,
    },
    wildcard: {
      stat: (id) => finishSpread(positionsOf(id)),
      more: 1,
      label: `Spread of finishing positions, Division ${division}`,
    },
    grinder: {
      stat: (id) => (divisionOf.get(id) === division ? (practice.get(id) ?? 0) : null),
      more: 1,
      label: `Practice laps, Division ${division}`,
    },
  };
  const traitData = Object.fromEntries(
    (Object.keys(TRAITS) as TraitKey[]).map((k) => {
      const t = TRAITS[k];
      const group = divIds.map(t.stat).filter((x): x is number => x != null);
      const mine = t.stat(steamId);
      const pct =
        mine != null
          ? percentileOf(
              mine * t.more,
              group.map((x) => x * t.more)
            )
          : undefined;
      // Rank within the division on this trait: 1 = the most of it.
      const rank = mine != null ? 1 + group.filter((x) => x * t.more > mine * t.more).length : null;
      return [k, { group, mine, pct, rank }];
    })
  ) as Record<
    TraitKey,
    { group: number[]; mine: number | null; pct: number | undefined; rank: number | null }
  >;

  const roundsStarted = numbers.races;
  const totalRounds = div.races.length;
  const archetype = pickArchetype({
    racesStarted: roundsStarted,
    traits: Object.fromEntries(
      (Object.keys(traitData) as TraitKey[]).map((k) => [k, traitData[k].pct])
    ),
  });

  const evidenceFor = (k: ArchetypeKey): string => {
    if (k === 'racer') return `${roundsStarted} of ${totalRounds} rounds started`;
    const { mine, rank, group } = traitData[k];
    const of = `${rank} of ${group.length} in Division ${division}`;
    const m = mine ?? 0;
    switch (k) {
      case 'frontrunner':
        return `Average finish of P${m.toFixed(1)}, ${of}`;
      case 'metronome':
        return `Consistency rating of ${Math.round(m * 100)}, ${of}`;
      case 'charger':
        return `${m >= 0 ? '+' : ''}${m.toFixed(1)} places a race from qualifying, ${of}`;
      case 'qualifier':
        return `Qualified ${Math.abs(m).toFixed(1)} places ahead of where you finished, ${of}`;
      case 'bloomer':
        return `${m.toFixed(1)} places better in the second half, ${of}`;
      case 'wildcard': {
        const f = finishesOf(steamId);
        return `Finishes anywhere from P${Math.min(...f)} to P${Math.max(...f)}, ${of}`;
      }
      case 'grinder':
        return `${Math.round(m).toLocaleString('en-US')} practice laps, ${of}`;
    }
  };
  const evidence = { [archetype.key]: evidenceFor(archetype.key) };

  const n = findNemesis(steamId, div.races);
  const me = people.get(steamId);

  const posIn = (race: WrappedRace, id: string) =>
    race.entries.find((e) => e.steamId === id)?.position ?? null;
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
  const trackOfRound = (round: number) => trackName(div.races[round - 1]?.trackKey ?? '');

  // Teammate: the one they shared the most rounds with.
  let teammate: WrappedDriverCard['teammate'] = null;
  const team = data.teams.find(([, ids]) => ids.includes(steamId));
  if (team) {
    const mates = team[1].filter((id) => id !== steamId);
    const scored = mates.map((mate) => {
      const race = { me: 0, them: 0 };
      const quali = { me: 0, them: 0 };
      div.races.forEach((r, k) => {
        const a = r.entries.find((e) => e.steamId === steamId)?.position;
        const b = r.entries.find((e) => e.steamId === mate)?.position;
        if (a != null && b != null) {
          if (a < b) race.me++;
          else race.them++;
        }
        const q = new Map(divRaw.quali[k] ?? []);
        const qa = q.get(steamId);
        const qb = q.get(mate);
        if (qa != null && qb != null) {
          if (qa < qb) quali.me++;
          else quali.them++;
        }
      });
      return { mate, race, quali, together: race.me + race.them };
    });
    const best = scored.sort((x, y) => y.together - x.together)[0];
    if (best && best.together > 0) {
      teammate = {
        name: people.get(best.mate)?.name ?? best.mate,
        number: people.get(best.mate)?.number ?? null,
        team: team[0],
        race: best.race,
        quali: best.quali,
      };
    }
  }

  // Saturday vs Sunday.
  const qf: { q: number; f: number; round: number }[] = [];
  div.races.forEach((r, k) => {
    const f = r.entries.find((e) => e.steamId === steamId)?.position;
    const q = new Map(divRaw.quali[k] ?? []).get(steamId);
    if (f != null && q != null) qf.push({ q, f, round: r.round });
  });
  const saturday: WrappedDriverCard['saturday'] =
    qf.length >= 3
      ? (() => {
          const top = qf.slice().sort((x, y) => y.q - y.f - (x.q - x.f))[0];
          return {
            avgQuali: avg(qf.map((x) => x.q)),
            avgFinish: avg(qf.map((x) => x.f)),
            gained: qf.reduce((n, x) => n + (x.q - x.f), 0),
            bestGain:
              top.q - top.f > 0 ? { places: top.q - top.f, track: trackOfRound(top.round) } : null,
          };
        })()
      : null;

  // Sectors: purple count, and their single best sector rank of the season.
  let purple = 0;
  let bestSector: { rank: number; sector: number; track: string } | null = null;
  divRaw.sectors.forEach((field, k) => {
    const mine = field.find(([id]) => id === steamId)?.[1];
    if (!mine) return;
    for (let sIdx = 0; sIdx < 3; sIdx++) {
      const rank = 1 + field.filter(([, s]) => s[sIdx] < mine[sIdx]).length;
      if (rank === 1) purple++;
      if (!bestSector || rank < bestSector.rank)
        bestSector = { rank, sector: sIdx + 1, track: trackOfRound(k + 1) };
    }
  });
  const sectors: WrappedDriverCard['sectors'] = bestSector ? { purple, best: bestSector } : null;

  // Rating arc.
  const myRatings = (new Map(data.ratings).get(steamId) ?? []).slice().sort((a, b) => a[0] - b[0]);
  const rating: WrappedDriverCard['rating'] =
    myRatings.length >= 2
      ? (() => {
          const peak = myRatings.reduce((m, r) => (r[1] > m[1] ? r : m));
          const r1 = (x: number) => Math.round(x * 1000) / 10;
          return {
            start: r1(myRatings[0][1]),
            end: r1(myRatings[myRatings.length - 1][1]),
            peak: r1(peak[1]),
            peakTrack: trackOfRound(peak[0]),
          };
        })()
      : null;

  // Clean racing: rounds raced with no penalty points and no warnings.
  const stwRounds = new Map(
    (new Map(data.stewarding).get(steamId) ?? []).map(([round, pp, w]) => [round, { pp, w }])
  );
  const racedRounds = div.races
    .filter((r) => r.entries.some((e) => e.steamId === steamId))
    .map((r) => r.round);
  const clean: WrappedDriverCard['clean'] = {
    pp: [...stwRounds.values()].reduce((n, x) => n + x.pp, 0),
    warnings: [...stwRounds.values()].reduce((n, x) => n + x.w, 0),
    cleanRounds: racedRounds.filter(
      (r) => !stwRounds.get(r) || (stwRounds.get(r)!.pp === 0 && stwRounds.get(r)!.w === 0)
    ).length,
    rounds: racedRounds.length,
  };

  // Easter egg: a season mostly in the Jaguar G3 (ACC model 14).
  const JAGUAR_G3 = 14;
  const car = data.cars.find(([id]) => id === steamId);
  const easterEggs: EasterEgg[] = [];
  if (car && car[1] === JAGUAR_G3 && car[2] >= Math.ceil(roundsStarted / 2)) {
    const beaten = new Set<string>();
    for (const race of div.races) {
      const me = race.entries.find((e) => e.steamId === steamId);
      if (me) for (const e of race.entries) if (e.position > me.position) beaten.add(e.steamId);
    }
    const fin = finishesOf(steamId);
    easterEggs.push({ kind: 'jag', races: car[2], best: Math.min(...fin), beaten: beaten.size });
  }
  // Easter egg: the sweatiest driver in SRA — #1 on the Sweatshop board.
  const [top, second] = data.sweatTop;
  if (top && top[0] === steamId) {
    easterEggs.push({
      kind: 'sweat',
      laps: top[1].laps,
      margin: second ? top[1].laps - second[1].laps : top[1].laps,
      runnerUp: second ? (people.get(second[0])?.name ?? second[1].name) : '',
      days: new Map(data.practiceDays).get(steamId) ?? 0,
      seasonDays: data.seasonDays,
    });
  }

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
      easterEggs,
      driverId: new Map(data.driverIds).get(steamId) ?? null,
      teammate,
      saturday,
      sectors,
      rating,
      clean,
    },
  };
}
