import 'server-only';
import { ImageResponse } from 'next/og';
import { thumbnailFonts, thumbnailImage } from '@/lib/stream/thumbnail-assets';
import type { LeagueWrapped } from './card';

// The league Wrapped poster as a 1080×1350 PNG: Season 19 champions, one
// block per division (drivers', teams', Silver), plus the season's totals.
// The link preview for /wrapped/s19/league and its download.

const W = 1080;
const H = 1350;
const GOLD = '#E6B53D';
const CARBON = '#0A0B0E';
const MUTED = 'rgba(255,255,255,0.55)';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

export async function renderLeaguePoster(L: LeagueWrapped): Promise<ImageResponse> {
  const [fonts, lockup] = await Promise.all([
    thumbnailFonts(),
    thumbnailImage('/badges/sra-lockup.webp', 260, 76).catch(() => null),
  ]);

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
      <div
        style={{
          height: 450,
          display: 'flex',
          flexDirection: 'column',
          padding: '60px 64px 44px',
          background: GOLD,
          color: CARBON,
        }}
      >
        <div style={{ display: 'flex', fontSize: 44, fontWeight: 900 }}>GT3 Team Series</div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 'auto',
            fontSize: 140,
            fontWeight: 900,
            lineHeight: 0.86,
            letterSpacing: -3,
          }}
        >
          <div style={{ display: 'flex' }}>Season 19</div>
          <div style={{ display: 'flex' }}>champions</div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '22px 64px 40px',
          color: '#fff',
        }}
      >
        {L.champions.map((ch, k) => (
          <div
            key={ch.division}
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '13px 0',
              borderBottom: k < L.champions.length - 1 ? '2px solid rgba(255,255,255,0.1)' : 'none',
            }}
          >
            <div
              style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: MUTED }}
            >{`Division ${ch.division}`}</div>
            <div style={{ display: 'flex', fontSize: 50, fontWeight: 900, lineHeight: 1.05 }}>
              {`${ch.driver.name}${ch.driver.number != null ? `  #${ch.driver.number}` : ''}`}
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 30,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.75)',
              }}
            >
              {[
                ch.team ? `Teams: ${ch.team.name}` : null,
                ch.silver ? `Silver: ${ch.silver.name}` : null,
              ]
                .filter(Boolean)
                .join('   ·   ')}
            </div>
          </div>
        ))}

        <div
          style={{
            display: 'flex',
            marginTop: 'auto',
            fontSize: 34,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.78)',
          }}
        >
          {`${fmt(L.drivers)} drivers, ${fmt(L.km)} km, ${L.rounds} rounds.`}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 20,
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
