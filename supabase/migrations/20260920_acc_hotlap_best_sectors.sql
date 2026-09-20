-- Potential-best sectors for the ACC hot-lap boards.
--
-- sectors_ms is the split of the driver's single best lap. best_sectors_ms is
-- the per-sector MINIMUM across every valid lap the driver turned at that
-- track in that car (same PK dimensions) — summed, the "Potential Best (Valid)"
-- lap the site shows when a board row is expanded. Surfaced on the seasonal
-- boards first: the gap between best and potential per class is a direct read
-- on how much pace a car has in hand, which is what BoP decisions need.
--
-- Written by the SRA-Bot ingest (app/util/leaderboard/ingest.py) as sessions
-- arrive, merged min-per-sector with the stored value; historical rows are
-- filled by SRA-Bot/scripts/apply_best_sectors.py from the ACCSM result
-- archive. NULL = not yet computed (legacy pickle rows have no per-lap data and
-- stay NULL until the track is driven again).
--
-- Same jsonb int[] shape as sectors_ms. Nullable, no default: an empty array
-- would read as "zero sectors", not "unknown".

alter table public.acc_hotlap_leaderboard
  add column if not exists best_sectors_ms jsonb;

comment on column public.acc_hotlap_leaderboard.best_sectors_ms is
  'Per-sector minimum (ms) across all valid laps for this (track, car, driver, board) — potential best. NULL = not computed.';
