import 'server-only';
import { ImageResponse } from 'next/og';
import { thumbnailFonts, thumbnailImage } from '@/lib/stream/thumbnail-assets';
import type { WrappedDriverCard } from './card';

// The Wrapped share poster as a 1080×1350 PNG — the download, and the link
// preview for /wrapped/s19/s/<token>. Same layout as the story's last slide:
// gold hero (number, name, archetype), carbon body (best rounds, nemesis,
// the season as one line, distance), SRA lockup.

const W = 1080;
const H = 1350;
const HERO_H = 610;
const GOLD = '#E6B53D';
const CARBON = '#0A0B0E';
const MUTED = 'rgba(255,255,255,0.55)';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

export async function renderWrappedPoster(card: WrappedDriverCard): Promise<ImageResponse> {
  const [fonts, lockup] = await Promise.all([
    thumbnailFonts(),
    thumbnailImage('/badges/sra-lockup.webp', 260, 76).catch(() => null),
  ]);

  const title = card.archetype.title;
  const longest = Math.max(...title.split(' ').map((w) => w.length));
  const titleSize = Math.floor(Math.min(190, (W - 128) / (longest * 0.46)));

  const finishes = card.rounds.filter((r) => r.position != null);
  const top3 = finishes
    .slice()
    .sort((a, b) => a.position! - b.position! || a.round - b.round)
    .slice(0, 3);

  // Season trace geometry (same rules as the story's SeasonTrace).
  const TW = W - 128;
  const TH = 210;
  const pts = card.rounds
    .map((r, i) => ({ i, p: r.position }))
    .filter((q): q is { i: number; p: number } => q.p != null);
  const best = pts.length ? Math.min(...pts.map((q) => q.p)) : 1;
  const worst = pts.length ? Math.max(...pts.map((q) => q.p)) : 1;
  const span = Math.max(worst - best, 1);
  const tx = (i: number) => 30 + (i * (TW - 60)) / Math.max(1, card.rounds.length - 1);
  const ty = (p: number) => 70 + ((p - best) / span) * (TH - 120);
  const bestQ = pts.find((q) => q.p === best);
  const worstQ = pts.find((q) => q.p === worst);

  return new ImageResponse(
    <div
      style={{
        width: W,
        height: H,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '"Saira Condensed"',
        background: CARBON,
      }}
    >
      {/* Hero */}
      <div
        style={{
          height: HERO_H,
          display: 'flex',
          flexDirection: 'column',
          padding: '64px 64px 48px',
          background: GOLD,
          color: CARBON,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {card.number != null && (
              <div
                style={{
                  display: 'flex',
                  background: '#fff',
                  border: `5px solid ${CARBON}`,
                  borderRadius: 12,
                  padding: '0 18px',
                  fontSize: 72,
                  fontWeight: 900,
                  lineHeight: 1.1,
                }}
              >
                {String(card.number)}
              </div>
            )}
            <div style={{ display: 'flex', marginLeft: 24, fontSize: 58, fontWeight: 900 }}>
              {card.name}
            </div>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 'auto',
            fontSize: titleSize,
            fontWeight: 900,
            lineHeight: 0.86,
            letterSpacing: -3,
          }}
        >
          {title.split(' ').map((w, k) => (
            <div key={k} style={{ display: 'flex' }}>
              {w.replace(/-/g, '‑')}
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '48px 64px 52px',
          color: '#fff',
        }}
      >
        <div style={{ display: 'flex' }}>
          <div style={{ display: 'flex', flexDirection: 'column', width: 470 }}>
            <div
              style={{
                display: 'flex',
                fontSize: 30,
                fontWeight: 700,
                color: MUTED,
                marginBottom: 14,
              }}
            >
              Best rounds
            </div>
            {top3.map((r) => (
              <div
                key={r.round}
                style={{ display: 'flex', fontSize: 42, fontWeight: 700, lineHeight: 1.25 }}
              >
                <span style={{ fontWeight: 900, marginRight: 14 }}>{`P${r.position}`}</span>
                {r.track}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                display: 'flex',
                fontSize: 30,
                fontWeight: 700,
                color: MUTED,
                marginBottom: 14,
              }}
            >
              Nemesis
            </div>
            {card.nemesis ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', fontSize: 42, fontWeight: 900, lineHeight: 1.25 }}>
                  {card.nemesis.name}
                </div>
                <div style={{ display: 'flex', fontSize: 42, fontWeight: 700, lineHeight: 1.25 }}>
                  {`You ${card.nemesis.ahead}, them ${card.nemesis.behind}`}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', fontSize: 42, fontWeight: 700 }}>Nobody, really</div>
            )}
          </div>
        </div>

        {pts.length >= 2 && (
          <div
            style={{
              display: 'flex',
              position: 'relative',
              width: TW,
              height: TH,
              marginTop: 'auto',
            }}
          >
            <svg width={TW} height={TH} viewBox={`0 0 ${TW} ${TH}`}>
              {pts.slice(1).map((q, k) => {
                const a = pts[k];
                const gap = q.i - a.i > 1;
                return (
                  <line
                    key={k}
                    x1={tx(a.i)}
                    y1={ty(a.p)}
                    x2={tx(q.i)}
                    y2={ty(q.p)}
                    stroke={GOLD}
                    strokeWidth={gap ? 4 : 9}
                    strokeLinecap="round"
                    strokeDasharray={gap ? '4 16' : undefined}
                    opacity={gap ? 0.55 : 1}
                  />
                );
              })}
              {pts.map((q) => (
                <circle
                  key={q.i}
                  cx={tx(q.i)}
                  cy={ty(q.p)}
                  r={q === bestQ ? 16 : 9}
                  fill={q === bestQ ? GOLD : CARBON}
                  stroke={GOLD}
                  strokeWidth={6}
                />
              ))}
            </svg>
            {bestQ && (
              <div
                style={{
                  position: 'absolute',
                  left: tx(bestQ.i) - 40,
                  top: ty(best) - 62,
                  width: 80,
                  display: 'flex',
                  justifyContent: 'center',
                  fontSize: 36,
                  fontWeight: 900,
                }}
              >
                {`P${best}`}
              </div>
            )}
            {worstQ && worst !== best && (
              <div
                style={{
                  position: 'absolute',
                  left: tx(worstQ.i) - 40,
                  top: ty(worst) + 20,
                  width: 80,
                  display: 'flex',
                  justifyContent: 'center',
                  fontSize: 36,
                  fontWeight: 900,
                  color: MUTED,
                }}
              >
                {`P${worst}`}
              </div>
            )}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            marginTop: 24,
            fontSize: 40,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.78)',
          }}
        >
          <span
            style={{ fontSize: 58, fontWeight: 900, color: '#fff', marginRight: 14 }}
          >{`${fmt(card.numbers.km)} km`}</span>
          {`across ${card.numbers.races} ${card.numbers.races === 1 ? 'round' : 'rounds'} in Division ${card.division}`}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 34,
          }}
        >
          {lockup ? (
            // eslint-disable-next-line @next/next/no-img-element -- Satori element
            <img src={lockup.src} width={lockup.width} height={lockup.height} alt="" />
          ) : (
            <div style={{ display: 'flex' }} />
          )}
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: MUTED }}>
            Season 19 Wrapped
          </div>
        </div>
      </div>
    </div>,
    { width: W, height: H, fonts }
  );
}
