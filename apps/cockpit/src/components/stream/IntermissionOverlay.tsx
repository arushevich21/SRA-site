import type { ChampionshipContent } from '@/content/championships';
import type { BoothMember, StreamRound } from '@/lib/stream/overlay-data';
import { OverlayFoot, OverlayFrame, OverlayLockup } from './OverlayPrimitives';

// Stock image for anyone without an uploaded photo (public/badges).
const DRIVER_PHOTO_PLACEHOLDER = '/badges/driver-placeholder.png';

// Between sessions: whoever is in the booth, and nothing else. One card per
// commentator, sized to however many there are, with the photo they chose on
// /profile — or the stock image.
export function IntermissionOverlay({
  championship,
  division,
  round,
  booth,
}: {
  championship: ChampionshipContent;
  division: number | null;
  round: StreamRound | null;
  booth: BoothMember[];
}) {
  return (
    <OverlayFrame ticker>
      <OverlayLockup
        championship={championship}
        title="We'll be right back"
        subtitle={booth.length ? 'Live from the booth' : undefined}
        division={division}
        round={round}
      />

      {booth.length === 0 ? (
        <div className="ov-empty">Back shortly</div>
      ) : (
        <div className="ov-booth-grid" data-count={Math.min(booth.length, 4)}>
          {booth.map((member) => (
            <div className="ov-booth-card" key={member.name}>
              <div className="ov-booth-avatar">
                {/* eslint-disable-next-line @next/next/no-img-element -- uploaded photo / stock image */}
                <img src={member.photoUrl ?? DRIVER_PHOTO_PLACEHOLDER} alt="" />
              </div>
              <div className="ov-booth-name">
                <span className="ov-live-dot" aria-hidden="true" />
                <b>{member.name}</b>
                {member.role && <span>{member.role}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <OverlayFoot left={<>{championship.raceFormat}</>} right="discord.gg/SimRacingAlliance" />
    </OverlayFrame>
  );
}

