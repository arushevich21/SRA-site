import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const value = process.argv[index];
  if (value?.startsWith('--')) args.set(value, process.argv[index + 1]);
}

const input = args.get('--input');
const output = args.get('--output');
const base = (args.get('--base') ?? 'http://127.0.0.1:3100').replace(/\/$/, '');
if (!input || !output) {
  throw new Error('Usage: node generate-obs-clone.mjs --input <OBS JSON> --output <clone JSON> [--base <URL>]');
}

// The overlays are authored for a 2560×1440 native canvas; a 1080p stream is
// OBS downscaling that render, never a second layout. The clone resizes every
// browser source to match, and compensates each scene item's scale so the
// on-canvas geometry is untouched — only the render resolution goes up.
const NATIVE_WIDTH = 2560;
const NATIVE_HEIGHT = 1440;

const document = JSON.parse(await fs.readFile(input, 'utf8'));
const overlay = (route) => `${base}/overlay/${route}`;
const mock = (kind) => `${base}/stream-mocks/external.html?kind=${kind}`;

function localUrl(source) {
  const name = source.name;
  const url = source.settings?.url ?? '';
  if (name === 'ACC PiP Gold Border') return mock('pip-border');
  if (name === 'ACC PiP VDO.Ninja Source') return mock('vdo-ninja');
  if (name === 'Commentators Overlay D1') return overlay('commentators/1');
  if (name === 'Discord Streamkit VC Commentators Twitch Overlay') return mock('discord');
  if (name === 'Drivers Standings D1 Overlay Page 1') return overlay('standings/division_1/driver');
  if (name === 'Drivers Standings D1 Overlay Page 2') return overlay('standings/division_1/driver?page=2');
  if (name === 'Intermission Overlay D1') return overlay('intermission/4');
  if (name === 'Partners Slideshow Overlay') return overlay('partners');
  if (name === 'Race Information Overlay D1') return overlay('race_information/1');
  if (name === 'Season Calendar Overlay D1') return overlay('season_calendar/1');
  if (name === 'Team Standings D1 Overlay') return overlay('standings/division_1/team');
  if (name === 'Track Map Overlay Barcelona') return overlay('track_maps/barcelona');
  if (name === 'Track Map Overlay Current') return overlay('track_maps/current');
  if (name === 'Sponsors Overlay') return overlay('sponsors');
  if (name === 'Sponsors Marquee Overlay' || name === 'Sponsors Marquee Race Overlay') return overlay('sponsors?mode=horizontal_marquee&opacity=0&size=3&speed=0.5');
  if (name === 'Sponsors Stream Starting Soon Overlay') return overlay('sponsors?opacity=0.5&footer_message=STREAM%20STARTING%20SOON%7CDRIVERS%20BRIEFING%20IN%20PROGRESS');
  if (name === 'Stream Ended Overlay') return overlay('sponsors?opacity=0.5&footer_message=STREAM%20OFFLINE');
  if (name === 'Stream Ending Thanks for Watching Overlay') return overlay('sponsors?opacity=0.5&footer_message=STREAM%20HAS%20ENDED%7CTHANKS%20FOR%20WATCHING!');
  if (name === 'SRA logo web watermark') return `${base}/stream-mocks/external.html?kind=watermark`;
  if (name === 'YouTube Background Video') return mock('youtube');
  throw new Error(`No local mapping for browser source: ${name} (${url})`);
}

let browserSourceCount = 0;
// name -> how much every scene item of that source must shrink to stay put.
const rescaled = new Map();
for (const source of document.sources ?? []) {
  if (source.id !== 'browser_source') continue;
  source.settings.url = localUrl(source);

  const previousWidth = source.settings.width ?? NATIVE_WIDTH;
  const previousHeight = source.settings.height ?? NATIVE_HEIGHT;
  source.settings.width = NATIVE_WIDTH;
  source.settings.height = NATIVE_HEIGHT;
  if (previousWidth !== NATIVE_WIDTH || previousHeight !== NATIVE_HEIGHT) {
    rescaled.set(source.name, {
      x: previousWidth / NATIVE_WIDTH,
      y: previousHeight / NATIVE_HEIGHT,
    });
  }
  browserSourceCount += 1;
}

// A scene item with bounds is already sized by its bounding box, so a bigger
// source only sharpens it. Everything else is placed by `scale`, which counts
// the source's own pixels and so has to come down by the same ratio.
let rescaledItemCount = 0;
for (const source of document.sources ?? []) {
  for (const item of source.settings?.items ?? []) {
    const ratio = rescaled.get(item.name);
    if (!ratio) continue;
    if ((item.bounds_type ?? 0) !== 0) continue;
    item.scale = { x: (item.scale?.x ?? 1) * ratio.x, y: (item.scale?.y ?? 1) * ratio.y };
    rescaledItemCount += 1;
  }
}

await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
process.stdout.write(
  `Wrote ${output} with ${browserSourceCount} local browser-source URLs using ${base}; ` +
    `${rescaled.size} resized to ${NATIVE_WIDTH}×${NATIVE_HEIGHT} (${rescaledItemCount} scene items rescaled)\n`,
);
