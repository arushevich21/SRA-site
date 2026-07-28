-- Migration: manufacturer-logos Storage bucket
--
-- Fallback car-manufacturer logos for manufacturers @cardog-icons/react has no
-- icon for (KTM, Alpine, Ginetta — see ACEVO_MANUFACTURERS in
-- apps/cockpit/src/lib/leaderboard-tracks.ts and
-- ACC_CAR_MANUFACTURER_CDN_SLUGS in packages/domain/src/acc/acc-constants.ts).
-- The old site's CDN that used to host these died with the site itself, so
-- this is our own replacement, uploaded via scripts/upload-manufacturer-logos.ts
-- from the game's own content/cars/<car>/ui/badge.png source files.
--
-- Public read so <Image>/FallbackLogoImage can serve them directly; uploads
-- happen via the service-role client (bypasses RLS) run locally by an admin,
-- so no anon insert policy is needed.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'manufacturer-logos',
  'manufacturer-logos',
  true,
  2097152, -- 2 MB
  ARRAY['image/png', 'image/webp', 'image/svg+xml', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "manufacturer_logos_public_read" ON storage.objects;
CREATE POLICY "manufacturer_logos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'manufacturer-logos');
