// Uploads manufacturer badge/logo images to the manufacturer-logos Supabase
// Storage bucket (see supabase/migrations/20260728_manufacturer_logos_bucket.sql),
// for the manufacturers @cardog-icons/react has no icon for at all — currently
// KTM, Alpine, Ginetta (see ACEVO_MANUFACTURERS in
// apps/cockpit/src/lib/leaderboard-tracks.ts). The old site's CDN that used to
// host these fallback logos died with the site itself; this bucket replaces it.
//
// SOURCING THE IMAGES: AC Evo (and Assetto Corsa generally) ships a UI badge
// per car in its own install:
//   <AC Evo install>/content/cars/<car_folder>/ui/badge.png
// Pull the badge for any KTM/Alpine/Ginetta car and rename it to the
// manufacturer slug before running this (see EXPECTED_SLUGS below) — the game
// files aren't reachable from here, so this script only handles the upload
// once you have the images locally.
//
// Usage:
//   pnpm exec tsx scripts/upload-manufacturer-logos.ts [source-dir]
// source-dir defaults to assets/manufacturer-logos/ at the repo root. Each
// image file's name (minus extension) becomes its slug — e.g. ktm.png is
// served at manufacturer-logos/ktm.png. Re-running overwrites (upsert), so
// updating a logo is just replacing the file and running again.
//
// Safe to re-run: every upload is an upsert.

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { extname, basename, join } from 'node:path';

const BUCKET = 'manufacturer-logos';

// Slugs the site actually looks up (see ACEVO_MANUFACTURERS in
// apps/cockpit/src/lib/leaderboard-tracks.ts) — printed as a checklist so it's
// obvious what's still missing after a run. Add to both places together when
// AC Evo content adds a manufacturer @cardog-icons doesn't cover.
const EXPECTED_SLUGS = ['ktm', 'alpine', 'ginetta'];

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey, { realtime: { transport: ws } });

async function main(): Promise<void> {
  const sourceDir = process.argv[2] ?? join(process.cwd(), 'assets', 'manufacturer-logos');

  if (!existsSync(sourceDir)) {
    console.error(`Source directory not found: ${sourceDir}`);
    console.error('\nDrop manufacturer logo images there first, named by slug, e.g.:');
    for (const slug of EXPECTED_SLUGS) console.error(`  ${slug}.png`);
    console.error(
      '\nSource: <AC Evo install>/content/cars/<car_folder>/ui/badge.png for a car of that manufacturer.',
    );
    process.exit(1);
  }

  const files = readdirSync(sourceDir).filter((f) => CONTENT_TYPES[extname(f).toLowerCase()]);
  if (files.length === 0) {
    console.error(`No image files found in ${sourceDir}`);
    process.exit(1);
  }

  const uploadedSlugs = new Set<string>();
  for (const file of files) {
    const slug = basename(file, extname(file)).toLowerCase();
    const contentType = CONTENT_TYPES[extname(file).toLowerCase()];
    const path = `${slug}${extname(file).toLowerCase()}`;
    const bytes = readFileSync(join(sourceDir, file));

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType, upsert: true });

    if (error) {
      console.error(`  FAILED  ${file} -> ${path}:`, error.message);
      continue;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    uploadedSlugs.add(slug);
    console.log(`  OK      ${file} -> ${data.publicUrl}`);
  }

  console.log(`\nUploaded ${uploadedSlugs.size}/${files.length} file(s).`);

  const missing = EXPECTED_SLUGS.filter((s) => !uploadedSlugs.has(s));
  if (missing.length > 0) {
    console.log(`Still missing (site expects these slugs but nothing was uploaded for them): ${missing.join(', ')}`);
  } else {
    console.log('All expected manufacturer slugs are covered.');
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
