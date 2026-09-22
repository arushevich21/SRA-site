import type { Weather } from '@/components/stream/RevealOverlay';

// Weather badge per round for the race thumbnails, keyed by championship
// slug then round number. The schedule (championship_rounds) has no weather
// column — the conditions are decided for the schedule reveal show and, like
// the reveal's ?tracks=…|weather URL, live outside the DB. null = no badge.
// A ?weather= query on /thumbnail/… overrides whatever is here.
export const ROUND_WEATHER: Record<string, Record<number, Weather | null>> = {
  'gt3-team-series-s19': {
    1: 'sunny', // Silverstone
    2: 'sunny', // Paul Ricard
    3: 'sunny', // Oulton Park
    4: 'sunny', // Mount Panorama
    5: 'wet', // Valencia
    6: 'night', // Kyalami
    7: 'sunny', // Imola
    8: 'sunny', // Brands Hatch
  },
};

export function roundWeather(slug: string, round: number): Weather | null {
  return ROUND_WEATHER[slug]?.[round] ?? null;
}
