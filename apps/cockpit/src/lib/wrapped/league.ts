import 'server-only';
import { getSeasonChampions } from '@/lib/graphics/season-champions';
import type { LeagueWrapped, WrappedDriverCard } from './card';

// The league Wrapped: totals and standouts from every driver's card, plus the
// champions from the final standings (SRA-scored, the same source as the
// champion graphics). Built once at snapshot time.

export async function buildLeague(registrationKey: string, cards: WrappedDriverCard[]): Promise<LeagueWrapped> {
  const sum = (f: (c: WrappedDriverCard) => number) => cards.reduce((n, c) => n + f(c), 0);

  const wins = cards.map((c) => ({ name: c.name, wins: c.rounds.filter((r) => r.position === 1).length }));
  const topWins = Math.max(0, ...wins.map((w) => w.wins));
  const purple = cards
    .map((c) => ({ name: c.name, purple: c.sectors?.purple ?? 0 }))
    .sort((a, b) => b.purple - a.purple)[0];
  const sweatCard = cards.find((c) => c.easterEggs.some((e) => e.kind === 'sweat'));
  const sweat = sweatCard?.easterEggs.find((e) => e.kind === 'sweat');

  const champs = await getSeasonChampions(registrationKey);
  const champions: LeagueWrapped['champions'] = champs.map((c) => ({
    division: c.division,
    driver: {
      name: c.driver.name,
      number: c.driver.number,
      points: c.driver.points,
      margin: c.driver.margin,
      wins: c.driver.wins,
    },
    silver: c.silver ? { name: c.silver.name, number: c.silver.number, overall: c.silver.overallPosition } : null,
    team: c.team
      ? { name: c.team.name, drivers: c.team.drivers.map((d) => d.name), points: c.team.points, margin: c.team.margin }
      : null,
  }));
  const closest = champions.slice().sort((a, b) => a.driver.margin - b.driver.margin)[0];

  return {
    drivers: cards.length,
    starts: sum((c) => c.numbers.races),
    rounds: Math.max(0, ...cards.map((c) => c.totalRounds)),
    divisions: new Set(cards.map((c) => c.division)).size,
    laps: sum((c) => c.numbers.laps),
    km: Math.round(sum((c) => c.numbers.km)),
    hours: Math.round(sum((c) => c.numbers.hours)),
    mostWins: topWins > 0 ? { names: wins.filter((w) => w.wins === topWins).map((w) => w.name), wins: topWins } : null,
    purpleKing: purple && purple.purple > 0 ? purple : null,
    sweatiest: sweat && sweat.kind === 'sweat' && sweatCard ? { name: sweatCard.name, laps: sweat.laps } : null,
    spotless: cards.filter((c) => c.clean.rounds >= 6 && c.clean.pp === 0 && c.clean.warnings === 0).length,
    closest: closest ? { division: closest.division, margin: closest.driver.margin, champion: closest.driver.name } : null,
    champions,
  };
}
