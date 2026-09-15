import { PARTNERS } from '@/content/partners';
import { SUPPORTERS } from '@/content/supporters';
import type { ChampionshipContent } from '@/content/championships';
import { OverlayFoot, OverlayFrame, OverlayLockup } from './OverlayPrimitives';

// Partners and supporters. Doubles as the holding screen: ?footer_message=
// ("STREAM STARTING SOON|DRIVERS BRIEFING IN PROGRESS") becomes the headline.
export function SponsorsOverlay({
  championship,
  message,
}: {
  championship: ChampionshipContent;
  message?: string;
}) {
  const lines = message?.split('|').map((s) => s.trim()).filter(Boolean) ?? [];

  return (
    <OverlayFrame>
      <OverlayLockup
        championship={championship}
        title={lines.length ? 'Sim Racing Alliance' : 'Thank you'}
        subtitle={lines.length ? undefined : 'To our partners and monthly supporters on Discord and Patreon'}
      />

      <div className="ov-thanks">
        <section className="ov-thanks-panel">
          <h2>League partners</h2>
          <div className="ov-partner-grid">
            {PARTNERS.map((p) => (
              <div key={p.name}>
                {/* eslint-disable-next-line @next/next/no-img-element -- static logo */}
                <img src={p.logo} alt={p.name} />
              </div>
            ))}
          </div>
        </section>
        <section className="ov-thanks-panel">
          <h2>Community supporters</h2>
          <div className="ov-supporter-list">
            {SUPPORTERS.map((name) => (
              <span key={name}>{name}</span>
            ))}
          </div>
        </section>
      </div>

      {lines.length ? (
        <p className="ov-message">
          {lines[0]}
          {lines[1] && <small>{lines.slice(1).join(' · ')}</small>}
        </p>
      ) : (
        <OverlayFoot left={<>Join us at <b>sra.gg/start</b></>} right="discord.gg/SimRacingAlliance" />
      )}
    </OverlayFrame>
  );
}
