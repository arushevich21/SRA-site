export type SimConfig = {
  slug: string;
  displayName: string;
  game: string;
  accentColor: string;
  accentVar: string;
};

export const SIMS: SimConfig[] = [
  { slug: 'acc',     displayName: 'Assetto Corsa Competizione', game: 'ACC',     accentColor: '#E04040', accentVar: '--accent-acc' },
  { slug: 'lmu',     displayName: 'Le Mans Ultimate',           game: 'LMU',     accentColor: '#3B82F6', accentVar: '--accent-lmu' },
  { slug: 'iracing', displayName: 'iRacing',                    game: 'iRacing', accentColor: '#C0C8D4', accentVar: '--accent-iracing' },
  { slug: 'acevo',   displayName: 'Assetto Corsa Evo',          game: 'AC Evo',  accentColor: '#F27A1A', accentVar: '--accent-acevo' },
];

export const SIM_SLUGS = SIMS.map(s => s.slug);

export function getSimBySlug(slug: string): SimConfig | undefined {
  return SIMS.find(s => s.slug === slug);
}
