import type { ChampionshipContent, ScheduleRound } from '@/content/championships';
import { OverlayHeader, OverlayPanel } from './OverlayPrimitives';

export function IntermissionOverlay({ championship, division, round }: { championship: ChampionshipContent; division: string; round?: ScheduleRound }) {
  return <><OverlayHeader title={`${championship.title} · Division ${division}`} subtitle={`Round ${round?.round ?? 'TBA'} · ${round?.track ?? 'Track TBA'}`} /><div className="stream-intermission"><OverlayPanel><div className="stream-photo-placeholder">DRIVER A</div><h2>Driver feature</h2><strong>Driver name pending</strong></OverlayPanel><OverlayPanel><div className="stream-photo-placeholder">DRIVER B</div><h2>Driver feature</h2><strong>Driver name pending</strong></OverlayPanel></div></>;
}
