import type { ScheduleRound } from '@/content/championships';
import { OverlayHeader, OverlayPanel } from './OverlayPrimitives';

export function TrackOverlay({ track, round }: { track: string; round?: ScheduleRound }) {
  return <><OverlayHeader title="TRACK MAP" subtitle="Sim Racing Alliance" /><div className="stream-track-layout"><OverlayPanel className="stream-track-map"><span className="stream-map-placeholder">{track.toUpperCase()}<br /><small>TRACK MAP</small></span></OverlayPanel><OverlayPanel className="stream-track-facts"><Fact label="Track" value={track} /><Fact label="Location" value="Location pending" /><Fact label="Length" value="Track data pending" /><Fact label="Turns" value="Track data pending" /><Fact label="Round" value={round ? `Round ${round.round}` : 'TBA'} /></OverlayPanel></div></>;
}

function Fact({ label, value }: { label: string; value: string }) { return <div><b>{label}:</b><strong>{value}</strong></div>; }
