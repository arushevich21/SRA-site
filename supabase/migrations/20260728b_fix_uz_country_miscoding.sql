-- Migration: correct drivers.country='UZ' -> 'US'
--
-- The bulk import from the old site mis-mapped US drivers to ISO code 'UZ'
-- (Uzbekistan) instead of 'US'. Confirmed by cross-referencing
-- timezone_offset: of 1,269 drivers coded 'UZ', 1,261 (99.4%) sit in North
-- American time zones (-05:00 x795, -08:00 x223, -06:00 x174, -07:00 x66,
-- -10:00 x3) -- consistent with a US-heavy NA sim racing league, and
-- inconsistent with a genuine Uzbek population that size. Only ONE row in
-- the entire table carried the correct 'US' code before this migration
-- (a driver who had manually corrected their own profile).
--
-- Safe to re-run: idempotent (no-ops once no 'UZ' rows remain).

UPDATE drivers SET country = 'US' WHERE country = 'UZ';
