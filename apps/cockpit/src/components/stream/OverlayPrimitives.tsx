import type { ReactNode } from 'react';
import type { ChampionshipContent } from '@/content/championships';
import type { StreamRound } from '@/lib/stream/overlay-data';
import { seasonLabel } from '@/lib/stream/labels';
import { SUPPORTERS } from '@/content/supporters';
import { shortTrackName } from '@/components/RoundCells';
import { countryFlagUrl } from '@/lib/country-flag';
import { trackFacts } from './track-maps';
import { OverlayRefresh } from './OverlayRefresh';
import type { OverlayRefreshPlan } from '@/lib/stream/refresh';

// The pieces every full-screen scene is assembled from. Layout lives in
// overlays.css; these only decide what goes where.

// Overlay routes share the site's root layout, and the chrome is switched off
// from here rather than by a second layout tree. It is an inline <style>, not
// a `body:has(.overlay-root)` rule in overlays.css, because OBS 30's browser
// source is Chromium 103 and :has() only arrived in 105 — under it the nav bar
// rendered above every scene and transparent scenes got an opaque body. The
// rules are unguarded, which is fine: this element only exists on /overlay.
const SITE_CHROME_OFF = `
body > header, body > footer, body > div.border-t { display: none !important; }
body > main { padding-top: 0 !important; }
body { background: #0a0b0e !important; }
`;
// The site's fixed body::before/::after backdrop (globals.css) would paint
// behind a transparent source — that's the game feed's space.
const TRANSPARENT_BODY = `
html, body { background: transparent !important; }
body::before, body::after { display: none !important; }
`;

export function OverlayCanvas({
  children,
  transparent = false,
  opacity,
  className = '',
  refresh,
}: {
  children: ReactNode;
  transparent?: boolean;
  opacity?: number;
  className?: string;
  // When this source re-fetches itself; see OverlayRefresh.
  refresh?: OverlayRefreshPlan;
}) {
  return (
    <div
      className={`overlay-root ${transparent ? 'ov-transparent' : ''} ${className}`}
      style={opacity === undefined ? undefined : { opacity }}
    >
      <style>{SITE_CHROME_OFF + (transparent ? TRANSPARENT_BODY : '')}</style>
      {refresh && <OverlayRefresh at={refresh.at} every={refresh.every} />}
      <div className="overlay-canvas">{children}</div>
    </div>
  );
}

// Safe-area frame: header row, content, footer row.
export function OverlayFrame({
  children,
  ticker = false,
}: {
  children: ReactNode;
  ticker?: boolean;
}) {
  return (
    <>
      {ticker && <SponsorTicker />}
      <div className={`ov-frame ${ticker ? 'has-ticker' : ''}`}>{children}</div>
    </>
  );
}

// Series identity on the left, what's on air on the right.
export function OverlayLockup({
  championship,
  title,
  subtitle,
  division,
  round,
}: {
  championship: ChampionshipContent;
  title: string;
  subtitle?: string;
  division?: number | null;
  round?: StreamRound | null;
}) {
  return (
    <header className="ov-lockup">
      {/* eslint-disable-next-line @next/next/no-img-element -- static badge, no optimisation needed in a browser source */}
      <img className="ov-lockup-badge" src="/badges/GT3TSAsset_white.png" alt="" />
      <div>
        <p className="ov-kicker">Sim Racing Alliance · {championship.game} · {seasonLabel(championship)}</p>
        <h1 className="ov-title">{title}</h1>
        {subtitle && <p className="ov-subtitle">{subtitle}</p>}
      </div>
      {(division != null || round) && (
        <div className="ov-context">
          {division != null && (
            <div className="ov-context-division">
              <small>DIV</small>
              {division}
            </div>
          )}
          {round && (
            <div className="ov-context-round">
              <b>Round {round.round.round}</b>
              <span>
                <TrackFlag track={round.round.track} />
                {shortTrackName(round.round.track)}
              </span>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

export function OverlayFoot({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <footer className="ov-foot">
      <div>{left}</div>
      {right && <div>{right}</div>}
    </footer>
  );
}

export function SponsorTicker() {
  const message = (
    <>
      {SUPPORTERS.map((name, index) => (
        <span key={name}>
          {index > 0 && <i>•</i>}
          {name}
        </span>
      ))}
      <i>•</i>
      Thank you for supporting SRA
    </>
  );
  return (
    <div className="ov-ticker">
      <div className="ov-ticker-label">SUPPORTERS</div>
      <div className="ov-ticker-window">
        <div className="ov-ticker-track">
          <span>{message}</span>
          <span aria-hidden="true">{message}</span>
        </div>
      </div>
    </div>
  );
}

// The circuit's country flag (flagcdn, same source as the leaderboards).
// Nothing for a TBA or unknown track.
export function TrackFlag({ track, large = false }: { track: string; large?: boolean }) {
  const country = trackFacts(track)?.country;
  if (!country) return null;
  // The site's helper serves the 40px asset; the headline flag needs the
  // 160px one or it pixelates at broadcast size.
  const src = large ? countryFlagUrl(country).replace('/w40/', '/w160/') : countryFlagUrl(country);
  // eslint-disable-next-line @next/next/no-img-element -- external CDN flag
  return <img className={`ov-flag ${large ? 'is-large' : ''}`} src={src} alt="" />;
}
