import 'server-only';
import { supabase } from '@/lib/supabase';
import { resolveAccTrackName } from '@/lib/acc/track-name';
import {
  getPlacings,
  getRaceRecord,
  getRating,
  resultLinkers,
  type RaceRecord,
  type RatingSnapshot,
} from '@/lib/driver-stats';

// Head-to-head between two drivers. "Meetings" are rounds where both
// drivers' results pin to the SAME race file (same division grid) — see
// supabase/migrations/20261012d_race_participation_head_to_head.sql for how
// a result is pinned and why a bare same-round comparison would be wrong.
// Rounds that can't be pinned are counted, never guessed.

export type H2HDriver = {
  id: string;
  name: string;
  number: number | null;
  steamId: string; // bare
  division: number | null;
};

export type Meeting = {
  season: number;
  round: number;
  track: string;
  date: string;
  aPos: number;
  bPos: number;
  href: string | null;
};

export type SharedBoard = { season: string; track: string; href: string; aPos: number; bPos: number };

export type HeadToHead = {
  meetings: Meeting[];
  aAhead: number;
  bAhead: number;
  differentDivisions: number; // same round, verified different grids
  unmatched: number; // same round, at least one result not pinned
  boards: { shared: SharedBoard[]; aFaster: number; bFaster: number };
  a: { record: RaceRecord | null; rating: RatingSnapshot | null };
  b: { record: RaceRecord | null; rating: RatingSnapshot | null };
};

type Row = {
  season: number;
  event: number;
  track: string | null;
  event_date: string;
  a_pos: number;
  b_pos: number;
  verified: boolean;
  same_race: boolean;
};

export async function getHeadToHead(a: H2HDriver, b: H2HDriver): Promise<HeadToHead> {
  const pa = `S${a.steamId}`;
  const pb = `S${b.steamId}`;
  const [rows, aRecord, aRating, bRecord, bRating, aBoards, bBoards, linkers] = await Promise.all([
    supabase.rpc('driver_head_to_head', { p_a: pa, p_b: pb }).then(({ data, error }) => {
      if (error) console.error('driver_head_to_head failed:', error);
      return (data ?? []) as Row[];
    }),
    getRaceRecord(pa),
    getRating(pa),
    getRaceRecord(pb),
    getRating(pb),
    getPlacings(pa),
    getPlacings(pb),
    resultLinkers(),
  ]);

  // A meeting's result page opens on the division they shared — the current
  // division of driver A when known (both raced the same grid, so either's
  // division is right whenever it's still current).
  const division = a.division ?? b.division;
  const meetings = rows
    .filter((r) => r.same_race)
    .map((r) => {
      const linker = linkers.get(r.season);
      return {
        season: r.season,
        round: r.event,
        track: resolveAccTrackName(r.track ?? ''),
        date: r.event_date,
        aPos: r.a_pos,
        bPos: r.b_pos,
        href:
          linker && linker.rounds.has(r.event)
            ? `/acc/championships/${linker.slug}/results/${r.event}${division ? `?division=${division}` : ''}`
            : null,
      };
    });

  const bBy = new Map(bBoards.map((p) => [`${p.season}|${p.href}`, p]));
  const shared: SharedBoard[] = [];
  for (const p of aBoards) {
    const q = bBy.get(`${p.season}|${p.href}`);
    if (q) shared.push({ season: p.season, track: p.track, href: p.href, aPos: p.position, bPos: q.position });
  }
  shared.sort((x, y) => Math.min(x.aPos, x.bPos) - Math.min(y.aPos, y.bPos));

  return {
    meetings,
    aAhead: meetings.filter((m) => m.aPos < m.bPos).length,
    bAhead: meetings.filter((m) => m.bPos < m.aPos).length,
    differentDivisions: rows.filter((r) => r.verified && !r.same_race).length,
    unmatched: rows.filter((r) => !r.verified).length,
    boards: {
      shared,
      aFaster: shared.filter((s) => s.aPos < s.bPos).length,
      bFaster: shared.filter((s) => s.bPos < s.aPos).length,
    },
    a: { record: aRecord, rating: aRating },
    b: { record: bRecord, rating: bRating },
  };
}
