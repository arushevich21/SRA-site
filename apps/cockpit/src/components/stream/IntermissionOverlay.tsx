import type { ChampionshipContent, ScheduleRound } from '@/content/championships';
import { OverlayHeader, OverlayPanel } from './OverlayPrimitives';
import { MOCK_COMMENTATORS } from './commentator-data';

export function IntermissionOverlay({ championship, division, round }: { championship: ChampionshipContent; division: string; round?: ScheduleRound }) {
  const commentators = MOCK_COMMENTATORS.slice(0, 3);
  const commentatorCount = commentators.length;

  return <>
    <OverlayHeader
      title={`${championship.title} Â· Division ${division}`}
      subtitle={`Round ${round?.round ?? 'TBA'} Â· ${round?.track ?? 'Track TBA'} Â· ${commentatorCount} in the booth`}
    />
    <div className={`stream-intermission stream-intermission-${commentatorCount}`}>
      {commentators.map((commentator) => (
        <OverlayPanel key={commentator.name}>
          <div className="stream-booth-status"><span className="stream-commentator-live-dot" /> ON AIR</div>
          <h2>{commentator.name}</h2>
          <strong>{commentator.role}</strong>
        </OverlayPanel>
      ))}
    </div>
  </>;
}
