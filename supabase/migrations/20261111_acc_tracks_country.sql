-- ISO 3166-1 alpha-2 country per ACC track, for the flags on the /about/stats
-- Tracks board. Only nurburgring had one. Fills NULLs only, so a hand-set
-- value is never overwritten. location is left alone: TrackHeader renders
-- the flag only alongside location, so track pages don't change.
update public.acc_tracks t
set country = v.country
from (values
  ('barcelona', 'es'), ('brands_hatch', 'gb'), ('cota', 'us'), ('donington', 'gb'),
  ('hungaroring', 'hu'), ('imola', 'it'), ('indianapolis', 'us'), ('kyalami', 'za'),
  ('laguna_seca', 'us'), ('misano', 'it'), ('monza', 'it'), ('mount_panorama', 'au'),
  ('nurburgring', 'de'), ('nurburgring_24h', 'de'), ('oulton_park', 'gb'), ('paul_ricard', 'fr'),
  ('red_bull_ring', 'at'), ('silverstone', 'gb'), ('snetterton', 'gb'), ('spa', 'be'),
  ('suzuka', 'jp'), ('valencia', 'es'), ('watkins_glen', 'us'), ('zandvoort', 'nl'),
  ('zolder', 'be')
) as v(track_key, country)
where t.track_key = v.track_key
  and t.country is null;
