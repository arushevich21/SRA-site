import type { ChampionshipContent } from '@/content/championships';
import type { BoothMember, StreamRound } from '@/lib/stream/overlay-data';
import { OverlayFoot, OverlayFrame, OverlayLockup } from './OverlayPrimitives';

// Between sessions: whoever is in the booth, and nothing else. One card per
// commentator, sized to however many there are.
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
                <span>{initials(member.name)}</span>
                {member.avatarUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- Discord CDN avatar
                  <img src={avatarAt(member.avatarUrl, 512)} alt="" />
                )}
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

// Discord's CDN serves avatars at any power-of-two ?size=; the stored URL
// has none, which defaults to 128px — soft at broadcast size.
function avatarAt(url: string, size: number): string {
  return url.includes('cdn.discordapp.com') ? `${url}?size=${size}` : url;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
