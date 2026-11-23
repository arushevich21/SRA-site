import 'server-only';
import { ImageResponse } from 'next/og';
import sharp from 'sharp';
import { accCarManufacturerIconName } from '@sra/domain';
import { thumbnailFonts, thumbnailImage, type ThumbImage } from '@/lib/stream/thumbnail-assets';
import type { ChampionDriver, DivisionChampions } from './season-champions';

// Champion graphics for a finished season: one per division per title
// (drivers' / teams'), in two formats:
//   square  1080×1080  Discord, Instagram, X
//   wide    1920×1080  stream, YouTube
// Satori composes it; every bitmap goes through sharp first (see
// thumbnail-assets.ts). Works with or without driver photos — without one,
// the race number fills the frame.
//
// Layout is fixed columns with explicit coordinates: Satori's flex sizing is
// unreliable once text has to shrink, so nothing here depends on it.

export type ChampionKind = 'driver' | 'team';
export type ChampionFormat = 'square' | 'wide';

const SIZE: Record<ChampionFormat, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  wide: { w: 1920, h: 1080 },
};

const GOLD = '#e6b53d';
const GOLD_SOFT = '#f2cf73';
const CARBON = '#0a0b0e';
const MUTED = '#8a92a0';
const SHADOW = '0 6px 24px rgba(0,0,0,0.6)';
const DRIVERS_TITLE = 'DRIVERS’ CHAMPIONSHIP';
const TEAMS_TITLE = 'TEAMS’ CHAMPIONSHIP';

export function championFileName(season: number, division: number, kind: ChampionKind, format: ChampionFormat) {
  return `SRA_S${season}_D${division}_${kind === 'driver' ? 'Drivers' : 'Teams'}_Champion${format === 'wide' ? '_16x9' : ''}.png`;
}

// A driver's broadcast photo (Supabase storage), cover-cropped to a box.
async function photo(url: string | null, w: number, h: number): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const buf = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(w * 2, h * 2, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 86 })
      .toBuffer();
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch {
    return null; // a missing photo never fails the graphic
  }
}

function carLogo(d: ChampionDriver, box: number): Promise<ThumbImage | null> {
  const icon = d.carModelId != null ? accCarManufacturerIconName(d.carModelId) : null;
  return icon ? thumbnailImage(`/car-logos/${icon}.svg`, box, box).catch(() => null) : Promise.resolve(null);
}

function Img({ image }: { image: ThumbImage }) {
  // eslint-disable-next-line @next/next/no-img-element -- Satori element
  return <img src={image.src} width={image.width} height={image.height} alt="" />;
}

// Skewed plate, the site's button shape. The whole plate leans, text included
// — reads as italic, same as the race thumbnails (the face has no italic).
function Plate({ children, size }: { children: string; size: number }) {
  return (
    <div
      style={{
        display: 'flex',
        background: GOLD,
        color: CARBON,
        fontSize: size,
        fontWeight: 900,
        lineHeight: 1,
        padding: `${Math.round(size * 0.22)}px ${Math.round(size * 0.5)}px`,
        transform: 'skewX(-10deg)',
        letterSpacing: 1,
      }}
    >
      {children}
    </div>
  );
}

function Stat({ value, label, size }: { value: string; label: string; size: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginRight: Math.round(size * 0.9) }}>
      <div style={{ display: 'flex', fontSize: size, fontWeight: 900, lineHeight: 1, color: '#fff' }}>{value}</div>
      <div style={{ display: 'flex', fontSize: Math.round(size * 0.32), fontWeight: 700, letterSpacing: 3, color: MUTED, marginTop: 6 }}>
        {label}
      </div>
    </div>
  );
}

export async function renderChampion(
  season: number,
  champs: DivisionChampions,
  kind: ChampionKind,
  format: ChampionFormat,
): Promise<ImageResponse> {
  const { w, h } = SIZE[format];
  const wide = format === 'wide';
  const team = kind === 'team' ? champs.team : null;
  if (kind === 'team' && !team) throw new Error('no team championship in this division');
  const driver = champs.driver;
  const people = team ? team.drivers : [driver];

  const PAD = wide ? 80 : 60;
  const TOP = wide ? 210 : 190;
  const textW = wide ? 960 : 520;
  const colX = wide ? 1120 : 610;
  const colW = w - colX - PAD; // 720 wide, 410 square
  const colH = wide ? 730 : 640;
  // Team: two portraits — side by side on wide, stacked on square.
  const gap = 20;
  const photoW = Math.round(team && wide ? (colW - gap) / 2 : colW);
  const photoH = Math.round(team && !wide ? (colH - gap) / 2 : colH);

  const [fonts, badge, series, sra, photos, logos] = await Promise.all([
    thumbnailFonts(),
    thumbnailImage(`/badges/Division ${champs.division}.png`, wide ? 190 : 150, wide ? 120 : 100),
    thumbnailImage('/badges/GT3TS_Logo.png', wide ? 260 : 210, wide ? 120 : 96),
    thumbnailImage('/badges/SRA_FLAG-17.png', wide ? 110 : 90, wide ? 60 : 48).catch(() => null),
    Promise.all(people.map((p) => photo(p.photoUrl, photoW, photoH))),
    Promise.all(people.map((p) => carLogo(p, wide ? 64 : 48))),
  ]);

  const title = (team ? team.name : driver.name).toUpperCase();
  // Saira Condensed Black runs ~0.52em per uppercase glyph. Size so the
  // longest word fits the column and the whole title fits on two lines.
  const longest = Math.max(...title.split(/\s+/).map((x) => x.length));
  const titleSize = Math.round(
    Math.min(wide ? 140 : 100, textW / (longest * 0.52), (textW * 2) / (title.length * 0.52)),
  );

  const stats: [string, string][] = team
    ? [
        [String(team.points), 'POINTS'],
        [`+${team.margin}`, 'MARGIN'],
        [String(team.wins), team.wins === 1 ? 'RACE WIN' : 'RACE WINS'],
      ]
    : [
        [String(driver.points), 'POINTS'],
        [`+${driver.margin}`, 'MARGIN'],
        [String(driver.wins), driver.wins === 1 ? 'WIN' : 'WINS'],
        [String(driver.podiums), 'PODIUMS'],
      ];

  const portrait = (i: number) => {
    const p = people[i];
    const src = photos[i];
    const numStr = p.number != null ? String(p.number) : 'SRA';
    const fadeH = Math.min(Math.round(photoH * 0.5), 220);
    return (
      <div
        key={p.steamId}
        style={{
          display: 'flex',
          position: 'relative',
          width: photoW,
          height: photoH,
          border: `3px solid ${GOLD}`,
          background: 'linear-gradient(160deg, #1b1e26 0%, #0c0e12 100%)',
          overflow: 'hidden',
        }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- Satori element
          <img src={src} width={photoW} height={photoH} alt="" style={{ objectFit: 'cover' }} />
        ) : (
          // No photo: the race number fills the frame instead.
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: photoW,
              height: photoH - fadeH * 0.4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: Math.round(Math.min(photoH * 0.7, photoW / (Math.max(numStr.length, 2) * 0.52))),
              fontWeight: 900,
              color: 'rgba(230,181,61,0.28)',
              transform: 'skewX(-10deg)',
              lineHeight: 1,
            }}
          >
            {numStr}
          </div>
        )}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: photoH - fadeH,
            width: photoW,
            height: fadeH,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            padding: 18,
            background: 'linear-gradient(180deg, rgba(10,11,14,0) 0%, rgba(10,11,14,0.94) 100%)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {team && (
              <div style={{ display: 'flex', fontSize: wide ? 38 : 30, fontWeight: 900, color: '#fff', lineHeight: 1, marginBottom: 10 }}>
                {p.name.toUpperCase()}
              </div>
            )}
            {p.number != null && (
              <div style={{ display: 'flex' }}>
                <Plate size={wide ? 36 : 28}>{`#${p.number}`}</Plate>
              </div>
            )}
          </div>
          {logos[i] && <Img image={logos[i]!} />}
        </div>
      </div>
    );
  };

  return new ImageResponse(
    (
      <div
        style={{
          width: w,
          height: h,
          display: 'flex',
          position: 'relative',
          fontFamily: '"Saira Condensed"',
          color: '#fff',
          background: `radial-gradient(900px 700px at ${wide ? '78%' : '80%'} 0%, rgba(230,181,61,0.22), transparent 65%), linear-gradient(180deg, #0d0f13 0%, ${CARBON} 100%)`,
        }}
      >
        {/* Diagonal gold light band, as on the site background. */}
        <div
          style={{
            position: 'absolute',
            top: -200,
            left: wide ? 980 : 540,
            width: wide ? 160 : 120,
            height: h + 400,
            background: 'linear-gradient(180deg, rgba(230,181,61,0.14), rgba(230,181,61,0.02))',
            transform: 'rotate(18deg)',
          }}
        />
        <div style={{ position: 'absolute', top: 0, left: 0, width: 10, height: h, background: GOLD }} />

        {/* Header */}
        <div style={{ position: 'absolute', top: wide ? 48 : 40, left: PAD, display: 'flex' }}>
          <Img image={badge} />
        </div>
        <div style={{ position: 'absolute', top: wide ? 48 : 40, right: PAD, display: 'flex' }}>
          <Img image={series} />
        </div>

        {/* Portrait column */}
        <div
          style={{
            position: 'absolute',
            left: colX,
            top: TOP,
            width: colW,
            height: colH,
            display: 'flex',
            flexDirection: team && !wide ? 'column' : 'row',
            justifyContent: 'space-between',
          }}
        >
          {people.map((_, i) => portrait(i))}
        </div>

        {/* Text column: header block top, name middle, stats bottom. */}
        <div
          style={{
            position: 'absolute',
            left: PAD,
            top: TOP,
            width: textW,
            height: colH,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', width: textW }}>
            <div style={{ display: 'flex', fontSize: wide ? 34 : 26, fontWeight: 700, letterSpacing: 6, color: MUTED }}>
              {`SEASON ${season} · DIVISION ${champs.division}`}
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: wide ? 176 : 118,
                fontWeight: 900,
                lineHeight: 0.9,
                color: GOLD,
                letterSpacing: 2,
                transform: 'skewX(-8deg)',
                textShadow: SHADOW,
                marginTop: 10,
              }}
            >
              CHAMPION
            </div>
            <div style={{ display: 'flex', fontSize: wide ? 38 : 26, fontWeight: 900, letterSpacing: wide ? 7 : 5, color: GOLD_SOFT, marginTop: 8 }}>
              {team ? TEAMS_TITLE : DRIVERS_TITLE}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', width: textW }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                width: textW,
                fontSize: titleSize,
                fontWeight: 900,
                lineHeight: 0.92,
                color: '#fff',
                textShadow: SHADOW,
              }}
            >
              {title}
            </div>
            {!team && driver.teamName && (
              <div style={{ display: 'flex', fontSize: wide ? 32 : 24, fontWeight: 700, color: MUTED, marginTop: 10, letterSpacing: 2 }}>
                {driver.teamName.toUpperCase()}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', width: textW }}>
            {stats.map(([v, l]) => (
              <Stat key={l} value={v} label={l} size={wide ? 76 : 52} />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            left: PAD,
            top: h - (wide ? 100 : 84),
            width: w - 2 * PAD,
            height: wide ? 60 : 52,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: wide ? 28 : 22,
            fontWeight: 700,
            letterSpacing: 4,
            color: MUTED,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {sra && <Img image={sra} />}
            <div style={{ display: 'flex', marginLeft: 16 }}>SIM RACING ALLIANCE</div>
          </div>
          <div style={{ display: 'flex' }}>SIMRACINGALLIANCE.COM</div>
        </div>
      </div>
    ),
    { width: w, height: h, fonts },
  );
}
