-- Migration: correct drivers.country miscoding — GW->PL
--
-- Same class of bug as 20260728b/c/d (US->UZ, Canada->CM, Mexico->MA,
-- UK->UY): Poland mis-mapped to Guinea-Bissau (GW). Confirmed directly —
-- Pawel Kreska (known Polish driver) was coded 'GW'. Unlike the earlier
-- fixes, GW's 14 rows don't show a single clean timezone cluster (they're
-- scattered: -05:00 x5, +01:00 x3, -08:00 x3, +02:00 x2, +00:00 x1) --
-- timezone alone wouldn't have flagged this pairing confidently. Applied on
-- direct confirmation from a league admin who identified the driver.
--
-- Safe to re-run: idempotent (no-ops once no GW rows remain).

UPDATE drivers SET country = 'PL' WHERE country = 'GW';
