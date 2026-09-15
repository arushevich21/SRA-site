import type { ChampionshipContent } from '@/content/championships';

// Pure label helpers shared by the overlay components (which must stay free
// of server-only imports so they render from either side).

// "Season 19" out of "GT3 Team Series — Season 19"; the whole title otherwise.
export function seasonLabel(champ: ChampionshipContent): string {
  return champ.title.match(/Season\s+\d+/i)?.[0] ?? champ.title;
}

// "S19" for the compact race label.
export function seasonShort(champ: ChampionshipContent): string {
  const n = champ.title.match(/Season\s+(\d+)/i)?.[1];
  return n ? `S${n}` : champ.classTag;
}

// "GT3 Team Series" out of "GT3 Team Series — Season 19".
export function seriesName(champ: ChampionshipContent): string {
  return champ.title.split(/\s+[—–-]\s+/)[0].trim() || champ.title;
}
