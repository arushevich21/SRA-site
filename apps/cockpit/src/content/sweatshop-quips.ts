import type { ValidityTier } from '@sra/domain';

// Sweatshop leader callouts, keyed by how the leader's valid-lap rate
// compares to the field's (validityTier in packages/domain/src/acc/sweatshop.ts
// sets the bands). Edit freely — add lines to any list and they enter the
// rotation. {pct} = the leader's valid %, {track} = the track's name.
//
// season: the line under the leader's name in the season-total hero.
// track:  follows the leader's name in the By Track banner ("<NAME> …").
export const SWEATSHOP_QUIPS: Record<ValidityTier, { season: string[]; track: string[] }> = {
  spotless: {
    season: [
      'Most laps in the paddock and {pct}% of them valid. Annoyingly tidy.',
      'Lives on the hotlap server and somehow never touches the paint.',
      'Has never met a track limit warning. {pct}% valid.',
    ],
    track: [
      "owns {track} and hasn't put a wheel wrong",
      'has {track} on rails: {pct}% valid',
      'could lap {track} blindfolded and still stay inside the lines',
    ],
  },
  clean: {
    season: [
      'Lives on the hotlap server. Has seen every kerb.',
      'Has more laps this season than some people have in the sim.',
      'Rent is due on the hotlap server and they are the only tenant.',
    ],
    track: [
      'basically lives at {track} now',
      'has a parking spot with their name on it at {track}',
      'is on first-name terms with every marshal at {track}',
    ],
  },
  sloppy: {
    season: [
      'More laps than anyone, but only {pct}% stayed inside the white lines.',
      'Grinding hard, reading the track limits rules less hard. {pct}% valid.',
      'Quantity: elite. Track limits: negotiable. {pct}% valid.',
    ],
    track: [
      "lives at {track} and still can't find the track limits",
      'treats the white lines at {track} as a rough guide',
      'has done a lot of laps at {track}. Some of them even counted.',
    ],
  },
  wild: {
    season: [
      '{pct}% valid. The white lines are more of a suggestion.',
      'Has turned more laps on the grass than most people have on the track.',
      '{pct}% valid. The kerbs have filed a complaint.',
    ],
    track: [
      "has seen more of {track}'s run-off than its racing line",
      'is mowing the lawn at {track}, {pct}% valid',
      'thinks the gravel at {track} is part of the racing line',
    ],
  },
  feral: {
    season: [
      '{pct}% valid. Race control has a folder with their name on it.',
      '{pct}% valid. At this point the kerbs are paying rent.',
      'Every lap is a hot lap if you ignore the track limits. {pct}% valid.',
    ],
    track: [
      'is redrawing the map of {track} one cut at a time',
      'has found shortcuts at {track} the track designers never intended',
      'is lapping {track} with {pct}% valid. The stewards need a vacation.',
    ],
  },
};

// Special numbers: when the valid % rounds to one of these, its line replaces
// the tier's. `tag` is the aside shown after that % in the board's Laps column.
export const NUMBER_QUIPS: Record<number, { season: string; track: string; tag: string }> = {
  69: {
    season: '69% of their laps were valid. Nice.',
    track: 'is running a 69% valid rate at {track}. Nice.',
    tag: 'nice',
  },
  67: {
    season: '67% valid. Six seven 🤷 Nobody knows what it means, track limits included.',
    track: 'is sitting on 67% valid at {track}. Six seven 🤷 The stewards are in Gen Z jail.',
    tag: '6 7 🤷',
  },
};

// Stable pick: the same driver at the same track always gets the same line
// (no flicker between ISR renders), but different tracks and seasons rotate.
export function pickQuip(
  tier: ValidityTier,
  kind: 'season' | 'track',
  seed: string,
  vars: { pct: number | null; track?: string },
): string {
  const lines = SWEATSHOP_QUIPS[tier][kind];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const special = vars.pct != null ? NUMBER_QUIPS[vars.pct] : undefined;
  const line = special ? special[kind] : lines[h % lines.length];
  return line
    .replaceAll('{pct}', String(vars.pct ?? 0))
    .replaceAll('{track}', vars.track ?? '');
}
