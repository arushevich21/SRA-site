import { ImageResponse } from 'next/og';
import { WEATHER, type Weather } from '@/components/stream/RevealOverlay';
import { isTbaTrack, trackMapUrl, trackPhotoUrl } from '@/components/stream/track-maps';
import type { ChampionshipContent, ScheduleRound } from '@/content/championships';
import { PARTNERS, PARTNER_TIERS } from '@/content/partners';
import { seasonLabel, seasonShort } from '@/lib/stream/labels';
import {
  THUMB_HEIGHT,
  THUMB_WIDTH,
  thumbnailBackdrop,
  thumbnailFonts,
  thumbnailImage,
  type ThumbImage,
} from '@/lib/stream/thumbnail-assets';

// The YouTube / Twitch thumbnail for one division's race night, composed by
// Satori from the schedule the overlays use. Layout follows the hand-made
// S15–S18 thumbnails: division badge top left, circuit map top centre,
// weather top right, "SEASON N - DIVISION N - ROUND N" over the gold circuit
// name, and the partner strip with the GT3 Team Series lockup along the foot.
// Served one at a time by /thumbnail/[slug]/[round]/[division] and as a
// season bundle by /thumbnail/[slug]/zip.

const GOLD = '#e3c063';
const TEXT_SHADOW = '0 4px 14px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.9)';

const STRIP_HEIGHT = 96;
const LOGO_BOX = { width: 74, height: 40 };
const SERIES_LOGO_BOX = { width: 240, height: 124 };

function Logo({ image }: { image: ThumbImage }) {
  // eslint-disable-next-line @next/next/no-img-element -- Satori element, not a DOM <img>
  return <img src={image.src} width={image.width} height={image.height} alt="" />;
}


// File name a downloaded thumbnail gets, e.g. SRA_S19_R3_D2.png.
export function thumbnailFileName(championship: ChampionshipContent, round: number, divisionId: number): string {
  return `SRA_${seasonShort(championship)}_R${round}_D${divisionId}.png`;
}

export async function renderThumbnail(
  championship: ChampionshipContent,
  round: ScheduleRound,
  divisionId: number,
  weather: Weather | null,
): Promise<ImageResponse> {
  const track = isTbaTrack(round.track) ? 'TBA' : round.track;
  const mapPath = trackMapUrl(round.track);
  const photoPath = trackPhotoUrl(round.track);

  // Partners in tier order, split either side of the series lockup.
  const partners = PARTNER_TIERS.flatMap((tier) => PARTNERS.filter((p) => p.tier === tier.key));
  const [fonts, backdrop, divisionBadge, map, weatherBadge, seriesLogo, partnerLogos] = await Promise.all([
    thumbnailFonts(),
    photoPath ? thumbnailBackdrop(photoPath) : null,
    thumbnailImage(`/badges/Division ${divisionId}.png`, 170, 124),
    mapPath ? thumbnailImage(mapPath, 540, 330) : null,
    weather ? thumbnailImage(WEATHER[weather].badge, 130, 130) : null,
    thumbnailImage('/badges/GT3TS_Logo.png', SERIES_LOGO_BOX.width, SERIES_LOGO_BOX.height),
    Promise.all(partners.map((p) => thumbnailImage(p.marquee.src, LOGO_BOX.width, LOGO_BOX.height))),
  ]);
  const half = Math.ceil(partnerLogos.length / 2);
  const leftLogos = partnerLogos.slice(0, half);
  const rightLogos = partnerLogos.slice(half);

  const headline = `${seasonLabel(championship)} - Division ${divisionId} - Round ${round.round}`.toUpperCase();

  return new ImageResponse(
    (
      <div
        style={{
          width: THUMB_WIDTH,
          height: THUMB_HEIGHT,
          display: 'flex',
          position: 'relative',
          background: '#0b0c10',
          fontFamily: '"Saira Condensed"',
          color: '#fff',
        }}
      >
        {backdrop && (
          // eslint-disable-next-line @next/next/no-img-element -- Satori element
          <img
            src={backdrop}
            width={THUMB_WIDTH}
            height={THUMB_HEIGHT}
            alt=""
            style={{ position: 'absolute', top: 0, left: 0, objectFit: 'cover' }}
          />
        )}
        {/* Vignette so the corners and the type band read against any photo. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.05) 30%, rgba(0,0,0,0.55) 62%, rgba(0,0,0,0.75) 100%)',
          }}
        />

        {/* Division badge, top left. */}
        <div style={{ position: 'absolute', top: 28, left: 32, display: 'flex' }}>
          <Logo image={divisionBadge} />
        </div>

        {/* Circuit map, top centre. */}
        {map && (
          <div
            style={{
              position: 'absolute',
              top: 26,
              left: 0,
              width: THUMB_WIDTH,
              height: 340,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Logo image={map} />
          </div>
        )}

        {/* Weather, top right. */}
        {weatherBadge && (
          <div
            style={{
              position: 'absolute',
              top: 28,
              right: 36,
              width: 130,
              height: 130,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Logo image={weatherBadge} />
          </div>
        )}

        {/* Headline + circuit name. Skewed because the display face has no
            italic and Satori won't synthesise one. */}
        <div
          style={{
            position: 'absolute',
            top: 372,
            left: 0,
            width: THUMB_WIDTH,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            transform: 'skewX(-8deg)',
          }}
        >
          <div
            style={{
              fontSize: 56,
              fontWeight: 900,
              letterSpacing: 2,
              lineHeight: 1,
              textShadow: TEXT_SHADOW,
              whiteSpace: 'nowrap',
            }}
          >
            {headline}
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: track.length > 18 ? 66 : 82,
              fontWeight: 900,
              letterSpacing: 3,
              lineHeight: 1,
              color: GOLD,
              textShadow: TEXT_SHADOW,
              whiteSpace: 'nowrap',
            }}
          >
            {track.toUpperCase()}
          </div>
        </div>

        {/* Partner strip with the series lockup breaking its top edge. */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            width: THUMB_WIDTH,
            height: STRIP_HEIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            background: 'rgba(8,8,10,0.9)',
            borderTop: '2px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'space-around' }}>
            {leftLogos.map((logo, i) => (
              <Logo key={`l${i}`} image={logo} />
            ))}
          </div>
          <div style={{ display: 'flex', width: SERIES_LOGO_BOX.width, flexShrink: 0 }} />
          <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'space-around' }}>
            {rightLogos.map((logo, i) => (
              <Logo key={`r${i}`} image={logo} />
            ))}
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            left: (THUMB_WIDTH - seriesLogo.width) / 2,
            bottom: (STRIP_HEIGHT - seriesLogo.height) / 2 + 8,
            display: 'flex',
          }}
        >
          <Logo image={seriesLogo} />
        </div>
      </div>
    ),
    {
      width: THUMB_WIDTH,
      height: THUMB_HEIGHT,
      fonts,
    },
  );
}
