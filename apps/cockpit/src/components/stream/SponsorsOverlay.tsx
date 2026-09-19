import { PARTNERS, PARTNER_TIERS } from '@/content/partners';
import type { ChampionshipContent } from '@/content/championships';
import { OverlayFoot, OverlayFrame, OverlayLockup } from './OverlayPrimitives';

// The holding screen and the sign-off. Everyone backing SRA scrolls past on
// the ticker, tier by tier, so the scene itself stays open — the hero clip
// through the middle, the headline from ?footer_message= ("STREAM STARTING
// SOON|DRIVERS BRIEFING IN PROGRESS"), and under it a strip of league-partner
// logos that fades between the partner tiers, SECONDS_PER_TIER each.

const SECONDS_PER_TIER = 8;
export function SponsorsOverlay({
  championship,
  message,
  headline = 'bottom',
}: {
  championship: ChampionshipContent;
  message?: string;
  // Where the headline sits: over the partner strip at the foot of the scene,
  // or up under the lockup rule with the clip between it and the strip.
  headline?: 'top' | 'bottom';
}) {
  const lines = message?.split('|').map((s) => s.trim()).filter(Boolean) ?? [];

  return (
    <OverlayFrame ticker>
      <OverlayLockup
        championship={championship}
        title={lines.length ? 'Sim Racing Alliance' : 'Thank you'}
        subtitle="Thanks to our partners, and everyone supporting SRA on Discord and Patreon"
      />

      <div className={`ov-thanks ${headline === 'top' ? 'is-headline-top' : ''}`}>
        {lines.length > 0 && (
          <p className="ov-message">
            {lines[0]}
            {lines[1] && <small>{lines.slice(1).join(' · ')}</small>}
          </p>
        )}
        <div
          className="ov-partner-cycle"
          style={{ '--ov-cycle-total': `${SECONDS_PER_TIER * PARTNER_TIERS.length}s` } as React.CSSProperties}
        >
          {PARTNER_TIERS.map((tier, i) => (
            <section
              className="ov-partner-strip"
              key={tier.key}
              style={{ '--ov-cycle-delay': `${i * SECONDS_PER_TIER}s` } as React.CSSProperties}
            >
              <h2>{tier.label}</h2>
              <div className="ov-partner-row">
                {PARTNERS.filter((p) => p.tier === tier.key).map((p) => (
                  <div key={p.name}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- static logo */}
                    <img src={p.logo} alt={p.name} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {lines.length === 0 && (
        <OverlayFoot left={<>Join us at <b>sra.gg/start</b></>} right="discord.gg/SimRacingAlliance" />
      )}
    </OverlayFrame>
  );
}
