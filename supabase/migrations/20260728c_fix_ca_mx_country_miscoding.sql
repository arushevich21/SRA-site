-- Migration: correct drivers.country miscoding — CM->CA, MA->MX
--
-- Same class of bug as 20260728b_fix_uz_country_miscoding.sql (US mis-mapped
-- to UZ), found while auditing further: Canada mis-mapped to Cameroon (CM),
-- Mexico mis-mapped to Morocco (MA). Confirmed by the same timezone
-- cross-reference: CM had 281 rows, 92% in North American time zones
-- (-05:00/-08:00/-07:00/-04:00/-06:00), with CA holding zero rows before this
-- migration. MA had 16 rows, 100% in North/Central American time zones
-- (-05:00 to -08:00 — Mexico's real range), with MX holding zero rows.
--
-- Safe to re-run: idempotent (no-ops once no CM/MA rows remain).

UPDATE drivers SET country = 'CA' WHERE country = 'CM';
UPDATE drivers SET country = 'MX' WHERE country = 'MA';
