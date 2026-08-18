import type { ChampionshipContent, ScheduleRound } from '@/content/championships';

/** ACC supplies the live HUD; this source supplies only the server-owned race label. */
export function RaceInformationOverlay({ championship, division, round }: { championship: ChampionshipContent; division: string; round?: ScheduleRound }) {
  return <div className="stream-race-top"><strong>{championship.title.match(/Season\s+\d+/)?.[0] ?? 'Season'} | D{division} | R{round?.round ?? 'TBA'} - {(round?.track ?? 'Track TBA').toUpperCase()}</strong></div>;
}
