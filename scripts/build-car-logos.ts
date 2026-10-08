// Writes every ACC and AC Evo manufacturer icon the site shows to a static
// SVG file (apps/cockpit/public/car-logos/<IconName>.svg) so <CarIcon> can
// serve it as a cached <img> instead of inlining it.
//
// Why: @cardog-icons/react renders each logo as a full inline <svg>, and these
// are detailed brand marks — 45 KB for Ferrari, 80 KB for Porsche. A
// standings table renders one per driver row, so a single division's table
// shipped ~1 MB of identical path data in its RSC payload, re-sent on every
// division/drivers/teams switch and re-parsed by the browser each time. As a
// file the browser downloads each logo once and caches it.
//
// The icons use hard-coded fills (no currentColor), so nothing is lost by
// rendering them through <img>.
//
// Re-run after adding an icon to ACC_CAR_MANUFACTURER_ICON_NAMES
// (packages/domain/src/acc/acc-constants.ts) or ACEVO_MANUFACTURERS
// (apps/cockpit/src/lib/acevo-manufacturers.ts); car-logos.test.ts fails
// until the new icon's file exists.
//
// Usage:
//   pnpm exec tsx scripts/build-car-logos.ts
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ACC_CAR_MANUFACTURER_ICON_NAMES } from '../packages/domain/src/acc/acc-constants';
import { ACEVO_MANUFACTURERS } from '../apps/cockpit/src/lib/acevo-manufacturers';

// react, react-dom and the icon package are cockpit dependencies, not root
// ones — resolve them from the app's own module tree (pnpm's strict layout).
const require = createRequire(path.resolve('apps/cockpit/package.json'));
const { createElement } = require('react') as typeof import('react');
const { renderToStaticMarkup } = require('react-dom/server') as typeof import('react-dom/server');
const { Icon } = require('@cardog-icons/react') as typeof import('@cardog-icons/react');

const OUT_DIR = path.resolve('apps/cockpit/public/car-logos');

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const names = [
    ...new Set([
      ...Object.values(ACC_CAR_MANUFACTURER_ICON_NAMES),
      ...ACEVO_MANUFACTURERS.flatMap(([, m]) => (m.icon ? [m.icon] : [])),
    ]),
  ].sort();

  for (const name of names) {
    // Size is irrelevant once it's an <img> — the viewBox scales it — but the
    // component requires one; <CarIcon> sets the rendered width/height.
    const svg = renderToStaticMarkup(
      createElement(Icon, { name: name as import('@cardog-icons/react').IconName, size: 64 }),
    );
    if (!svg.startsWith('<svg')) throw new Error(`No icon rendered for ${name}`);
    await writeFile(path.join(OUT_DIR, `${name}.svg`), svg);
    console.log(`${name}.svg  ${(svg.length / 1024).toFixed(1)} KB`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
