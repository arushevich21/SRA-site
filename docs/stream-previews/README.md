# Stream overlay previews

Renders of every `/overlay/...` browser source, captured from the local dev
server against live data (GT3 Team Series S19 entry list, LIAW for scored
standings). Regenerate after visual changes — the crew shares these for
feedback.

The overlays render at 2560×1440 natively; a 1080p stream is OBS downscaling
that render. Capture new previews at 2560×1440 so the shared images show what
the browser source actually produces. Scenes 06 and 07 are already at 2560×1440; the
rest are still the original 1920×1080 captures and are due a recapture.

Scenes 11 and 12 are transparent sources meant to sit over the game feed;
the white background is just the capture.

## Show scenes (13–15)

`/overlay/show` is the talk-show bed: ticker, lockup, three 16:9 camera
windows with a name plate under each. The windows are cut out of the page
with `clip-path`, so in OBS the browser source goes **on top** and the three
camera sources go **underneath** — whatever is in a window is cropped by it,
so cameras only need to be roughly in place. White in preview 13 is
transparency.

Window rects at 2560×1440 (canvas units × 25.6), left to right:

| Window | X      | Y     | W   | H   |
|--------|--------|-------|-----|-----|
| Left   |   76.8 | 486.4 | 768 | 432 |
| Middle |  896.0 | 486.4 | 768 | 432 |
| Right  | 1715.2 | 486.4 | 768 | 432 |

Sizing each camera to about 800×450 and centring it on its window gives a
little slack on every edge.

Scenes 14 and 15 are `/overlay/sponsors?video=1&footer_message=…` — the
sponsors scene over the site's ACC hero clip (`public/videos/acc_hero.mov`),
under the landing page's veil. No separate video source needed in OBS.
