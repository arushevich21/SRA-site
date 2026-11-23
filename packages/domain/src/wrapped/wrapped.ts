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

export type ArchetypeKey = 'metronome' | 'grinder' | 'charger' | 'qualifier' | 'ironman' | 'racer';

export type ArchetypeInput = {
  roundsStarted: number;
  totalRounds: number;
  /** Percentiles within the driver's comparison group, 0..1. */
  consistencyPct: number;
  /** Positions gained qualifying → finish, percentile (higher = gains more). */
  gainPct: number;
  /** Positions lost qualifying → finish, percentile (higher = loses more). */
  lossPct: number;
  practicePct: number;
};

export type Archetype = { key: ArchetypeKey; title: string; line: string };

const ARCHETYPES: Record<ArchetypeKey, Omit<Archetype, 'key'>> = {
  metronome: { title: 'The Metronome', line: 'Lap after lap, the same number. Nobody in your division was steadier.' },
  grinder: { title: 'The Grinder', line: 'You put in the laps before the lights went out. Few in the league practised more.' },
  charger: { title: 'The Charger', line: 'Wherever you started, you finished further up. Sundays were for passing.' },
  qualifier: { title: 'The Qualifier', line: 'One lap, flat out. Saturday was your day.' },
  ironman: { title: 'The Ironman', line: 'Every round, on the grid. A full season, start to finish.' },
  racer: { title: 'The Racer', line: 'Out there every week, in the thick of it.' },
};

/** A trait has to beat this share of the group to define you. */
const ARCHETYPE_BAR = 0.85;

/**
 * Most extreme trait that clears the bar wins; exact ties resolve in the
 * order listed (metronome, grinder, charger, qualifier). Otherwise a full
 * season is an Ironman, and everyone else is a Racer.
 */
export function pickArchetype(input: ArchetypeInput): Archetype {
  const traits: [ArchetypeKey, number][] = [
    ['metronome', input.consistencyPct],
    ['grinder', input.practicePct],
    ['charger', input.gainPct],
    ['qualifier', input.lossPct],
  ];
  let best: [ArchetypeKey, number] | null = null;
  for (const t of traits) {
    if (t[1] >= ARCHETYPE_BAR && (!best || t[1] > best[1])) best = t;
  }
  const key: ArchetypeKey = best
    ? best[0]
    : input.roundsStarted >= input.totalRounds
      ? 'ironman'
      : 'racer';
  return { key, ...ARCHETYPES[key] };
}
