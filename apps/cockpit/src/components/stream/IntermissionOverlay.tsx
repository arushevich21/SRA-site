import type { ChampionshipContent, ScheduleRound } from '@/content/championships';
import { OverlayHeader, OverlayPanel } from './OverlayPrimitives';
import { MOCK_COMMENTATORS } from './commentator-data';

// TODO(discord-voice-roster): Replace MOCK_COMMENTATORS with the cached roster
// reported by SRA-Bot. SRA runs four broadcasts each week: two simultaneous
// broadcasts on different platforms each night. The two Discord booth
// channels therefore map to the two concurrent broadcasts for that night
// (one booth per stream; the division pair changes by night). The bot should
// POST signed voiceStateUpdate snapshots to a site endpoint, and this overlay
// should select the roster for the active stream. Keep the last good snapshot
// so an OBS refresh or brief Discord outage does not blank the card.
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
