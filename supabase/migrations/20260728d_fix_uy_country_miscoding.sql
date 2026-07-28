-- Migration: correct drivers.country miscoding — UY->GB
--
-- Same class of bug as 20260728b/c (US->UZ, Canada->CM, Mexico->MA):
-- confirmed by timezone cross-reference. 63 rows coded 'UY' (Uruguay, real
-- UTC offset -03:00), but 42 of those 63 (67%) sit at +00:00 -- Uruguay's own
-- offset has ZERO representation in the bucket. GB (United Kingdom, +00:00)
-- held zero rows anywhere in the table before this migration, in a
-- North-American/English-language sim racing league where UK members are
-- entirely expected. Same "target bucket suspiciously empty" signature as
-- the CM/CA and MA/MX fixes, though the +00:00 signal is slightly less
-- unique than those (also plausible for Ireland/Portugal/West Africa) --
-- flagged as the best available call, not certainty.
--
-- Safe to re-run: idempotent (no-ops once no UY rows remain).

UPDATE drivers SET country = 'GB' WHERE country = 'UY';
