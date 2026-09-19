import type { ChampionshipContent } from '@/content/championships';
import { seriesName } from '@/lib/stream/labels';
import { OverlayFoot, OverlayFrame, OverlayLockup } from './OverlayPrimitives';
import type { Commentator } from './commentators';

// The talk-show bed: ticker, series lockup, and three camera windows with a
// name plate under each. The windows are holes — OverlayCanvas cuts them out
// of the whole page with clip-path (see CAM_WINDOWS), so in OBS this source
// sits on top and the three camera sources go underneath. Anything larger
// than a window is cropped by it, so the cameras only need to be roughly in
// place. Exact window rects at 2560×1440 are in docs/stream-previews.
//
//   /overlay/show?title=Season 19 Kickoff&names=Anton Rushevich,Douglas Mitchell,Jason Allen
//
// ?names= is left to right. ?subtitle= is optional; a "|" after a name gives
// that person a role line under their name.

// Camera windows in canvas units. Three 16:9 frames across the 94u content
// width: 30u wide, 2u apart, starting at the frame's 3u left padding.
// At 2560×1440 (1u = 25.6px): x 76.8 / 896 / 1715.2, y 486.4, 768×432.
export const CAM_WINDOWS = [3, 35, 67].map((x) => ({ x, y: 19, w: 30, h: 16.875 }));
// The live-chat window, bottom right under the third camera: it takes every
// row between that camera's name plate and the footer, with its tag turned
// on its side so none of the height goes to the label.
// At 2560×1440: x 1715.2, y 1036.8, 768×230.4 — sized to what the
// StreamElements widget actually paints, so no dead band under the messages.
export const CHAT_WINDOW = { x: 67, y: 40.5, w: 30, h: 9 };
// Every hole OverlayCanvas cuts for this scene.
export const SHOW_WINDOWS = [...CAM_WINDOWS, CHAT_WINDOW];

export function ShowOverlay({
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
      <OverlayLockup championship={championship} title={title} subtitle={subtitle ?? seriesName(championship)} />

      <div className="ov-show">
        {CAM_WINDOWS.map((win, i) => {
          const host = hosts[i];
          const [first, ...rest] = (host?.name ?? '').split(/\s+/);
          return (
            <div
              className="ov-cam"
              key={i}
              style={{
                left: `calc(${win.x} * var(--u))`,
                top: `calc(${win.y} * var(--u))`,
                width: `calc(${win.w} * var(--u))`,
                height: `calc(${win.h} * var(--u))`,
              }}
            >
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

      <div
        className="ov-cam ov-chat"
        style={{
          left: `calc(${CHAT_WINDOW.x} * var(--u))`,
          top: `calc(${CHAT_WINDOW.y} * var(--u))`,
          width: `calc(${CHAT_WINDOW.w} * var(--u))`,
          height: `calc(${CHAT_WINDOW.h} * var(--u))`,
        }}
      >
        <div className="ov-cam-frame" />
        <span className="ov-chat-tag">Live chat</span>
      </div>

      <OverlayFoot left="discord.gg/SimRacingAlliance" />
    </OverlayFrame>
  );
}
