/**
 * Season Wrapped — per-driver season stats. Pure: callers load the races,
 * track lengths and practice counts; nothing here touches the network or DB.
 *
 * Identity is the bare SteamID (digits, no "S" prefix) everywhere in this file.
 */

export type WrappedEntry = {
  steamId: string;
  position: number;
  laps: number;
  totalTimeMs: number;
};

export type WrappedRace = {
  round: number;
  trackKey: string;
  entries: WrappedEntry[];
};

export type SeasonNumbers = {
  races: number;
  laps: number;
  km: number;
  /** True when a raced track had no known length, so km undercounts. */
  kmIncomplete: boolean;
  hours: number;
  practiceLaps: number;
};

export function seasonNumbers(
  steamId: string,
  races: WrappedRace[],
  trackLengthsM: Record<string, number | null | undefined>,
  practiceLaps: number,
): SeasonNumbers {
  let started = 0;
  let laps = 0;
  let metres = 0;
  let ms = 0;
  let kmIncomplete = false;
  for (const race of races) {
    const e = race.entries.find((x) => x.steamId === steamId);
    if (!e) continue;
    started += 1;
    laps += e.laps;
    ms += e.totalTimeMs;
    const len = trackLengthsM[race.trackKey];
    if (len) metres += e.laps * len;
    else if (e.laps > 0) kmIncomplete = true;
  }
  return {
    races: started,
    laps,
    km: metres / 1000,
    kmIncomplete,
    hours: ms / 3_600_000,
    practiceLaps,
  };
}

export type Nemesis = {
  steamId: string;
  /** Races where the two finished in adjacent positions. */
  sideBySide: number;
  /** Head-to-head over every race both started. */
  ahead: number;
  behind: number;
  racesTogether: number;
};

/**
 * The driver you finished next to (adjacent positions) most often. Ties go
 * to the closer head-to-head record, then more races together, then the
 * lower SteamID — deterministic, so a page never changes on reload.
 */
export function findNemesis(steamId: string, races: WrappedRace[]): Nemesis | null {
  const stats = new Map<string, Nemesis>();
  const get = (id: string) => {
    let s = stats.get(id);
    if (!s) {
      s = { steamId: id, sideBySide: 0, ahead: 0, behind: 0, racesTogether: 0 };
      stats.set(id, s);
    }
    return s;
  };

  for (const race of races) {
    const me = race.entries.find((x) => x.steamId === steamId);
    if (!me) continue;
    for (const other of race.entries) {
      if (other.steamId === steamId) continue;
      const s = get(other.steamId);
      s.racesTogether += 1;
      if (me.position < other.position) s.ahead += 1;
      else s.behind += 1;
      if (Math.abs(me.position - other.position) === 1) s.sideBySide += 1;
    }
  }

  const candidates = [...stats.values()].filter((s) => s.sideBySide > 0);
  if (candidates.length === 0) return null;
  candidates.sort(
    (a, b) =>
      b.sideBySide - a.sideBySide ||
      Math.abs(a.ahead - a.behind) - Math.abs(b.ahead - b.behind) ||
      b.racesTogether - a.racesTogether ||
      (a.steamId < b.steamId ? -1 : 1),
  );
  return candidates[0];
}

/** Share of `field` that `value` beats or ties, 0..1. Higher value = higher percentile. */
export function percentileOf(value: number, field: number[]): number {
  if (field.length === 0) return 0;
  return field.filter((v) => v <= value).length / field.length;
}

/**
 * Places better the second half of the season averaged than the first
 * (positive = improved). Rounds split in two by index; rounds not started
 * (null) are skipped. Needs two finishes in each half.
 */
export function finishTrend(positions: (number | null)[]): number | null {
  const mid = Math.ceil(positions.length / 2);
  const firstHalf = positions.slice(0, mid).filter((p): p is number => p != null);
  const secondHalf = positions.slice(mid).filter((p): p is number => p != null);
  if (firstHalf.length < 2 || secondHalf.length < 2) return null;
  const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  return avg(firstHalf) - avg(secondHalf);
}

/** Standard deviation of finishing positions. Needs three finishes. */
export function finishSpread(positions: (number | null)[]): number | null {
  const xs = positions.filter((p): p is number => p != null);
  if (xs.length < 3) return null;
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length);
}

export type ArchetypeKey =
  | 'frontrunner'
  | 'metronome'
  | 'charger'
  | 'qualifier'
  | 'bloomer'
  | 'wildcard'
  | 'grinder'
  | 'racer';

/** Percentile of each trait within the driver's comparison group, 0..1. Missing = no data. */
export type ArchetypeTraits = Partial<Record<Exclude<ArchetypeKey, 'racer'>, number>>;

export type ArchetypeInput = { racesStarted: number; traits: ArchetypeTraits };

export type Archetype = { key: ArchetypeKey; title: string; line: string };

const ARCHETYPES: Record<ArchetypeKey, Omit<Archetype, 'key'>> = {
  frontrunner: { title: 'The Front-Runner', line: 'When the flag dropped, you were usually near the sharp end.' },
  metronome: { title: 'The Metronome', line: 'Lap after lap, the same number. Hard to find anyone steadier.' },
  charger: { title: 'The Charger', line: 'Wherever you started, you finished further up. Sundays were for passing.' },
  qualifier: { title: 'The Qualifier', line: 'One lap, flat out. Saturday was your day.' },
  bloomer: { title: 'The Late Bloomer', line: 'Slow start, strong finish. You found something halfway through.' },
  wildcard: { title: 'The Wildcard', line: 'Nobody knew which version of you would show up. Including you.' },
  grinder: { title: 'The Grinder', line: 'You put in the laps before the lights went out. Few in the league practiced more.' },
  racer: { title: 'The Racer', line: 'Out there when it counted.' },
};

// Exact ties resolve in this order, so the same data always gives the same card.
const TIE_ORDER: Exclude<ArchetypeKey, 'racer'>[] = [
  'frontrunner',
  'metronome',
  'charger',
  'qualifier',
  'bloomer',
  'wildcard',
  'grinder',
];

/**
 * Everyone with a real season (3+ races) gets the trait they rank highest
 * on within their group — no minimum bar. A bar left 41% of S19 drivers on
 * the generic fallback; a personality card has to say something about
 * everyone. The Racer is only for a season too short to read.
 */
export function pickArchetype(input: ArchetypeInput): Archetype {
  let best: [Exclude<ArchetypeKey, 'racer'>, number] | null = null;
  if (input.racesStarted >= 3) {
    for (const key of TIE_ORDER) {
      const v = input.traits[key];
      if (v != null && (!best || v > best[1])) best = [key, v];
    }
  }
  const key: ArchetypeKey = best ? best[0] : 'racer';
  return { key, ...ARCHETYPES[key] };
}
