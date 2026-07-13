export type SimConfig = {
  slug: string;
  displayName: string;
  game: string;
  accentColor: string;
  accentVar: string;
  tagline: string;
};

export const SIMS: SimConfig[] = [
  {
    slug: 'acc',
    displayName: 'Assetto Corsa Competizione',
    game: 'ACC',
    accentColor: '#E04040',
    accentVar: '--accent-acc',
    tagline: 'The official game of GT World Challenge — machinery built for competitive racing.',
  },
  {
    slug: 'lmu',
    displayName: 'Le Mans Ultimate',
    game: 'LMU',
    accentColor: '#3B82F6',
    accentVar: '--accent-lmu',
    tagline: 'The official game of the FIA World Endurance Championship and the 24 Hours of Le Mans.',
  },
  {
    slug: 'iracing',
    displayName: 'iRacing',
    game: 'iRacing',
    accentColor: '#C0C8D4',
    accentVar: '--accent-iracing',
    tagline: 'The most authentic motorsport sim on PC — real cars, real tracks, real competition, online.',
  },
  {
    slug: 'acevo',
    displayName: 'Assetto Corsa Evo',
    game: 'AC Evo',
    accentColor: '#F27A1A',
    accentVar: '--accent-acevo',
    tagline: 'The next evolution of Assetto Corsa — an expanding roster of cars and tracks spanning decades of motoring history.',
  },
];

export const SIM_SLUGS = SIMS.map(s => s.slug);

export function getSimBySlug(slug: string): SimConfig | undefined {
  return SIMS.find(s => s.slug === slug);
}
