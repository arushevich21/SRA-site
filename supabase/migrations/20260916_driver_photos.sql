-- Migration: broadcast photo on the driver profile
--
-- Commentators (and anyone who wants one) upload a photo of themselves on
-- /profile; the stream's intermission and lower-third show it. NULL means
-- "no photo" and the stream shows a stock silhouette — deliberately NOT the
-- Discord avatar (drivers.avatar_url), which is a different thing: that's
-- whatever they use on Discord, this is what they've chosen to put on air.
--
-- Uploads go through a Server Action using the service-role client (same as
-- championship logos), keyed <driver uuid>.<ext> with upsert so re-uploading
-- replaces rather than orphaning. Public read so the overlay and the profile
-- page can <img> the URL directly; no per-user storage write policy needed.

ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS photo_url text;

COMMENT ON COLUMN public.drivers.photo_url IS
  'Broadcast photo chosen by the driver on /profile (driver-photos bucket). NULL = stock image on stream. Not the Discord avatar.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'driver-photos',
  'driver-photos',
  true,
  2097152, -- 2 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "driver_photos_public_read" ON storage.objects;
CREATE POLICY "driver_photos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'driver-photos');
