-- Migration: championship-logos Storage bucket (Phase 2 of DB-backed events)
-- Admin-uploaded championship logos. Public read so <Image> can serve them
-- directly; uploads happen server-side via the service-role client (bypasses
-- RLS) behind requireAdmin(), so no anon insert policy is needed.

INSERT INTO storage.buckets (id, name, public)
VALUES ('championship-logos', 'championship-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read of objects in this bucket.
DROP POLICY IF EXISTS "championship_logos_public_read" ON storage.objects;
CREATE POLICY "championship_logos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'championship-logos');
