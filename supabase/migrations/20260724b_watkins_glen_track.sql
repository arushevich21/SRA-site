-- Pre-stage the Watkins Glen track for the SRAM1 (accsm1) quick races so it
-- renders fully curated the moment the first result is ingested, instead of
-- showing the raw placeholder key "watkins_glen".
--
-- ON CONFLICT DO UPDATE so this is correct whether it runs before ingestion
-- (inserts the curated row) or after (upgrades the auto-created placeholder).
-- The cron's upserts use ignoreDuplicates, so they never clobber these values.
--
-- ACC track key is "watkins_glen"; art already exists on the CDN.

INSERT INTO tracks (base_track_key, display_name, splash_art_url, country, location)
VALUES (
  'watkins_glen',
  'Watkins Glen',
  'https://static.simracingalliance.com/assets/images/tracks/photo_watkins_glen.jpg',
  'us',
  'Watkins Glen, New York'
)
ON CONFLICT (base_track_key) DO UPDATE SET
  display_name   = EXCLUDED.display_name,
  splash_art_url = EXCLUDED.splash_art_url,
  country        = EXCLUDED.country,
  location       = EXCLUDED.location;

INSERT INTO track_layouts (layout_key, base_track_key, game, layout_name, display_name, map_url)
VALUES (
  'watkins_glen',
  'watkins_glen',
  'ACC',
  NULL,
  'Watkins Glen',
  'https://static.simracingalliance.com/assets/images/tracks/track_map_logo_watkins_glen.png'
)
ON CONFLICT (layout_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  map_url      = EXCLUDED.map_url;
