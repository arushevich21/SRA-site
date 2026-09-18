import type { ChampionshipContent } from '@/content/championships';
import { seriesName } from '@/lib/stream/labels';
import { OverlayFoot, OverlayFrame, OverlayLockup } from './OverlayPrimitives';
import type { Commentator } from './commentators';

// The livery reveal bed: ticker, the show's lockup, three camera windows down
// the left with room for a name under each, and on the right a gold-outlined
// plate for the team's name with the stage under it left open for the livery
// shots. The camera windows are holes
// cut by OverlayCanvas (LIVERY_WINDOWS), so this source sits above the
// cameras in OBS. The livery shots go *above* this source instead: there's no
// hole or frame on the right, just the dark bed, so shots of any size or
// shape sit on it without a border to line up with (LIVERY_STAGE is the
// clear area). Names are optional — the crew's light-up name source goes in
// the gap under each camera when ?names= is left off.
//
//   /overlay/livery?team=Cybertron's Most Wanted [OBDA] x [#CULT]
//   /overlay/livery?team=...&names=Bailey Kish,Douglas Mitchell,Jason Allen
//
// ?team= fills the plate (left empty, the plate is still drawn as a slot).
// ?names= is top to bottom. ?title= and ?subtitle= are the lockup, defaulting
// to the show's title and the series.

// Camera column in canvas units: three 16:9 windows 15u wide at the frame's
// 3u left padding. The top one's top edge is on the team plate's, the bottom
// one ends with room for a name above the footer, the middle is centred
// between them; ~5u under each for a name.
// At 2560×1440 (1u = 25.6px): x 76.8, y 307.2 / 659.2 / 1011.2, 384×216.
export const LIVERY_CAMS = [12, 25.75, 39.5].map((y) => ({ x: 3, y, w: 15, h: 8.4375 }));
export const LIVERY_WINDOWS = LIVERY_CAMS;
// Right of the cameras: the team plate sits under the lockup with its bottom
// edge on the top camera's top edge, and the clear area for the livery shots
// runs from there to the footer. At 2560×1440 the plate is x 524.8, y 307.2,
// 1958.4×115.2 and the stage x 524.8, y 422.4, 1958.4×883.2.
export const TEAM_PLATE = { x: 20.5, y: 12, w: 76.5, h: 4.5 };
export const LIVERY_STAGE = { x: 20.5, y: 16.5, w: 76.5, h: 34.5 };
export const SHOW_TITLE = 'Season 19 Schedule & Livery Reveal';

const rect = (r: { x: number; y: number; w: number; h: number }) => ({
  left: `calc(${r.x} * var(--u))`,
  top: `calc(${r.y} * var(--u))`,
  width: `calc(${r.w} * var(--u))`,
  height: `calc(${r.h} * var(--u))`,
});

export function LiveryOverlay({
  championship,
  title,
  subtitle,
  team,
  hosts,
}: {
  championship: ChampionshipContent;
  title: string;
  subtitle?: string;
  team?: string;
  hosts: Commentator[];
}) {
  return (
    <OverlayFrame ticker>
      <OverlayLockup
        championship={championship}
        title={title}
        subtitle={subtitle ?? seriesName(championship)}
      />

      <div className="ov-show">
        <div className="ov-team-plate" style={rect(TEAM_PLATE)}>
          {team && <b>{team}</b>}
        </div>
        {LIVERY_CAMS.map((win, i) => {
          const host = hosts[i];
          const [first, ...rest] = (host?.name ?? '').split(/\s+/);
          return (
            <div className="ov-cam ov-cam-small" key={i} style={rect(win)}>
              <div className="ov-cam-frame" />
              {host && (
                <div className="ov-cam-name">
                  <b>
                    {first} <em>{rest.join(' ')}</em>
                  </b>
                  {host.role && <span>{host.role}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <OverlayFoot left="discord.gg/SimRacingAlliance" right="sra.gg" />
    </OverlayFrame>
  );
}
