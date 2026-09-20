// Generates the small WebP logos the site chrome serves — the footer sponsor
// marquee (apps/cockpit/public/sponsors/marquee/<slug>.webp) and the SRA
// lockup badge in the header/footer/home hero (public/badges/sra-lockup.webp)
// — from the full-size PNG originals. The marquee renders every logo inside
// an 88x48 box (see SponsorsCarousel), but the source PNGs are the stream /
// partners-page originals — two of them are 5,700–8,900px wide (123 KB and
// 642 KB) — so every visitor downloaded ~870 KB of PNG to paint ~1,000px of
// logos. Each output fits inside a 176x96 box (2x the rendered box, so the
// logos stay crisp on HiDPI displays) with aspect ratio preserved.
//
// Re-run after changing a partner's logo or adding one to MARQUEE_SOURCES,
// then paste the printed entries into PARTNERS (apps/cockpit/src/content/
// partners.ts) — the marquee needs each image's real width/height so
// next/image can reserve the right box without layout shift.
//
// Usage:
//   pnpm exec tsx scripts/build-sponsor-marquee-logos.ts
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

// sharp isn't a direct dependency of this repo — it ships as next's optional
// image-optimizer dependency, so resolve it from next's own module tree
// (pnpm's strict layout keeps it out of the root node_modules).
const require = createRequire(import.meta.url);
const nextDir = path.dirname(require.resolve('next/package.json', { paths: [path.resolve('apps/cockpit')] }));
const sharp: typeof import('sharp') = require(require.resolve('sharp', { paths: [nextDir] }));

const PUBLIC = path.resolve('apps/cockpit/public');
const OUT_DIR = path.join(PUBLIC, 'sponsors/marquee');

// Rendered box in SponsorsCarousel is 88x48; export at 2x for HiDPI.
const BOX_W = 88 * 2;
const BOX_H = 48 * 2;

// slug -> source path under public/ (URL-decoded, as on disk).
const MARQUEE_SOURCES: Record<string, string> = {
  armamentario: 'sponsors/partners/armamentario/ARMA-white.png',
  at3d: 'sponsors/sliders/at3d-sim-shop.png',
  'castle-cauldron': 'sponsors/sliders/castlecauldron.png',
  documize: 'sponsors/sliders/documize-com.png',
  'echoes-of-nox': 'sponsors/sliders/echoes_of_nox.png',
  'go-setups': 'sponsors/sliders/go-setups.png',
  'kp-concepts': 'sponsors/sliders/kp_concepts.png',
  'retro-saga': 'sponsors/sliders/retro-saga-ca.png',
  trackside: 'sponsors/sliders/TS_Logo_White_SVG.png',
  'trak-racer': 'sponsors/partners/trak-racer/logo-new.png',
  'triple-stint': 'sponsors/partners/triple-stint/White Text/Logo.png',
};

// The SRA lockup (badges/GT3TSAsset_white.png) is a 6,535x1,726 / 198 KB PNG
// that the header and footer render 36px tall and the home hero 180px wide.
// Its largest site render is that 180px hero, so export at 2x that width;
// the stream overlays keep using the original (broadcast graphics at 1080p+).
const LOCKUP_SRC = 'badges/GT3TSAsset_white.png';
const LOCKUP_OUT = path.join(PUBLIC, 'badges/sra-lockup.webp');
const LOCKUP_W = 180 * 2;

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const lockup = await sharp(path.join(PUBLIC, LOCKUP_SRC))
    .resize({ width: LOCKUP_W, withoutEnlargement: true })
    .webp({ quality: 85, alphaQuality: 90, effort: 6 })
    .toFile(LOCKUP_OUT);
  console.log(
    `  sra-lockup.webp: width ${lockup.width}, height ${lockup.height}  // ${(lockup.size / 1024).toFixed(1)} KB  <- ${LOCKUP_SRC}`,
  );

  for (const [slug, rel] of Object.entries(MARQUEE_SOURCES)) {
    const src = path.join(PUBLIC, rel);
    const out = path.join(OUT_DIR, `${slug}.webp`);
    const info = await sharp(src)
      // Logos are white-on-transparent; trim the transparent padding some of
      // the originals carry so the 88x48 box is filled by the mark itself.
      .trim({ threshold: 1 })
      .resize({ width: BOX_W, height: BOX_H, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85, alphaQuality: 90, effort: 6 })
      .toFile(out);
    console.log(
      `  { src: '/sponsors/marquee/${slug}.webp', width: ${info.width}, height: ${info.height} },  // ${(info.size / 1024).toFixed(1)} KB  <- ${rel}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
