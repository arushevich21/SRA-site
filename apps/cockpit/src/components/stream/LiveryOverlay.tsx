import type { ChampionshipContent } from '@/content/championships';
import { seriesName } from '@/lib/stream/labels';
import { OverlayFoot, OverlayFrame, OverlayLockup } from './OverlayPrimitives';
import type { Commentator } from './commentators';

// The livery reveal bed: ticker, the lockup, three camera windows down the
// left with room for a name under each, and the rest of the stage left bare.
// The camera windows are holes cut by OverlayCanvas (LIVERY_WINDOWS), so this
// source sits above the cameras in OBS; the livery shots and the team name go
// *above* it, on the clear stage (LIVERY_STAGE) and in the lockup's empty
// title row (TEAM_NAME_ROW) — nothing is drawn in either, so text and shots of
// any size sit on the bed with no border to line up with. Names under the
// cameras are optional; leave ?names= off for the crew's own name source.
//
//   /overlay/livery
//   /overlay/livery?names=Bailey Kish,Douglas Mitchell,Jason Allen
//
// ?names= is top to bottom. ?title= puts text back in the title row and
// ?subtitle= replaces the series line.

// Camera column in canvas units: three 16:9 windows 15u wide at the frame's
// 3u left padding. The top one's top edge is on the name row's, the bottom
// one ends with room for a name above the footer, the middle is centred
// between them; ~5u under each for a name.
// At 2560×1440 (1u = 25.6px): x 76.8, y 307.2 / 659.2 / 1011.2, 384×216.
export const LIVERY_CAMS = [12, 25.75, 39.5].map((y) => ({ x: 3, y, w: 15, h: 8.4375 }));
export const LIVERY_WINDOWS = LIVERY_CAMS;
// The lockup's title row, kept empty for the team name; and right of the
// cameras, the clear stage for the livery shots. At 2560×1440 the name row is
// x 524.8, y 268.8, 1958.4×92.2 and the stage x 524.8, y 422.4, 1958.4×883.2.
export const TEAM_NAME_ROW = { x: 20.5, y: 10.5, w: 76.5, h: 3.6 };
export const LIVERY_STAGE = { x: 20.5, y: 16.5, w: 76.5, h: 34.5 };

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
  hosts,
}: {
  championship: ChampionshipContent;
  title: string;
  subtitle?: string;
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
