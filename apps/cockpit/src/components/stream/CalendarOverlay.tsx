import type { ChampionshipContent, ScheduleRound } from '@/content/championships';
import Image from 'next/image';
import { OverlayHeader, OverlayPanel } from './OverlayPrimitives';

export function CalendarOverlay({ championship, division, rounds }: { championship: ChampionshipContent; division: string; rounds: ScheduleRound[] }) {
  return <>
    <OverlayHeader title={`${championship.title} Calendar`} subtitle={`Division ${division} · 8-week season`} />
    <Image className="stream-calendar-series-logo" src="/badges/GT3TS_Logo.png" alt="GT3 Team Series" width={400} height={200} sizes="12vw" unoptimized />
    <div className="stream-calendar-grid">{rounds.slice(0, 8).map((round) => <OverlayPanel key={round.round} className="stream-round-card"><div className="stream-round-heading"><b>R{round.round}: {round.track}</b><strong>{round.date?.slice(5, 10).replace('-', '/') ?? 'TBA'}</strong></div><div className="stream-round-map">TRACK MAP</div><span>{round.raceLength} · Race night</span></OverlayPanel>)}</div>
    <p className="stream-footer-note">All events begin at 9:00 PM Eastern · Visit simracingalliance.com/calendar for more information.</p>
  </>;
}
