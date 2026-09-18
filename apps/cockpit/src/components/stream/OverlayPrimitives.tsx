import type { ReactNode } from 'react';
import type { ChampionshipContent } from '@/content/championships';
import type { StreamRound } from '@/lib/stream/overlay-data';
import { seasonLabel } from '@/lib/stream/labels';
import { SUPPORTER_TIERS, type Supporter } from '@/content/supporters';
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

export type CanvasRect = { x: number; y: number; w: number; h: number }; // canvas units

// Holes through the whole page, so an OBS source underneath shows through
// exactly there and nowhere else. One polygon with even-odd fill: the outer
// rectangle, then each hole traced from and back to the same corner along a
// zero-width cut, which cancels itself out.
function cutoutClipPath(rects: CanvasRect[]): string {
  const u = (n: number) => `calc(${n} * var(--u))`;
  const points = ['0 0', '100% 0', '100% 100%', '0 100%'];
  for (const r of rects) {
    const [x1, y1, x2, y2] = [u(r.x), u(r.y), u(r.x + r.w), u(r.y + r.h)];
    points.push(`${x1} ${y1}`, `${x1} ${y2}`, `${x2} ${y2}`, `${x2} ${y1}`, `${x1} ${y1}`, '0 100%');
  }
  return `polygon(evenodd, ${points.join(', ')})`;
}

export function OverlayCanvas({
  children,
  transparent = false,
  opacity,
  className = '',
  refresh,
  cutouts,
  video,
}: {
  children: ReactNode;
  transparent?: boolean;
  opacity?: number;
  className?: string;
  // When this source re-fetches itself; see OverlayRefresh.
  refresh?: OverlayRefreshPlan;
  // Windows cut through the page (canvas units). The body goes transparent
  // so what's in OBS beneath shows through them; the canvas itself stays
  // painted everywhere else.
  cutouts?: CanvasRect[];
  // A looping, muted video bed under the canvas art (public/ path).
  video?: string;
}) {
  const seeThrough = transparent || (cutouts?.length ?? 0) > 0;
  return (
    <div
      className={`overlay-root ${transparent ? 'ov-transparent' : ''} ${seeThrough ? 'ov-see-through' : ''} ${video ? 'ov-has-video' : ''} ${className}`}
      style={opacity === undefined ? undefined : { opacity }}
    >
      <style>{SITE_CHROME_OFF + (seeThrough ? TRANSPARENT_BODY : '')}</style>
      {refresh && <OverlayRefresh at={refresh.at} every={refresh.every} />}
      <div
        className="overlay-canvas"
        style={cutouts?.length ? { clipPath: cutoutClipPath(cutouts) } : undefined}
      >
        {video && (
          // Muted + playsInline is what lets Chromium autoplay without a gesture,
          // which an OBS browser source never gets.
          <video className="ov-video" src={video} autoPlay muted loop playsInline aria-hidden="true" />
        )}
        {children}
      </div>
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
  badge,
}: {
  championship: ChampionshipContent;
  title: string;
  subtitle?: string;
  division?: number | null;
  round?: StreamRound | null;
  // A logo on the right in place of the division/round chip, for scenes
  // that aren't about one round (public/ path).
  badge?: string;
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
      {badge && (
        // eslint-disable-next-line @next/next/no-img-element -- static logo
        <img className="ov-lockup-brand" src={badge} alt="" />
      )}
      {!badge && (division != null || round) && (
        <div className="ov-context">
          {division != null && (
            <div className="ov-context-division">
              <small>DIV</small>
              <b>{division}</b>
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

// A supporter's name with their flag, and the star for someone backing SRA
// on both Discord and Patreon.
export function SupporterName({ person }: { person: Supporter }) {
  return (
    <>
      {person.country && (
        // eslint-disable-next-line @next/next/no-img-element -- external CDN flag
        <img className="ov-flag" src={countryFlagUrl(person.country)} alt="" />
      )}
      {person.name}
      {person.both && <b className="ov-star" title="Subscribed on Discord and Patreon">★</b>}
    </>
  );
}

// Every tier scrolls past in turn under its own label, the way the old scene
// collection's ticker read. Runs on every scene, holding screens included.
export function SponsorTicker() {
  const message = (
    <>
      {SUPPORTER_TIERS.map((tier) => (
        <span key={tier.key} className="ov-ticker-tier">
          <em>{tier.short}:</em>
          {tier.members.map((person, index) => (
            <span key={person.name}>
              {index > 0 && <i>•</i>}
              <SupporterName person={person} />
            </span>
          ))}
          <i>•</i>
        </span>
      ))}
      Thank you for supporting SRA
    </>
  );
  return (
    <div className="ov-ticker">
      <div className="ov-ticker-label">THANK YOU</div>
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
