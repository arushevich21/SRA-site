-- Migration: correct drivers.country miscoding — surname-evidence sweep
--
-- Continuation of 20260728b-f. These 10 pairs weren't confirmed by the
-- population/timezone-cluster method (too noisy at this scale) but by
-- reading driver names/surnames for a clear national-origin signal, same
-- proof standard as GW->PL (Pawel Kreska) and SY->SE (Bryan Anderson,
-- corroborated by Alex Carlsson / Oliwer Sjögren in the same bucket).
--
-- CI (Cote d'Ivoire) -> IT (Italy): 26 rows, overwhelmingly Italian names
--   (Giardinà, Sallustio, Alterio, Sindaco, Mancini, Ciancimino, Viggiano, ...).
-- NZ (New Zealand) -> NL (Netherlands): 27 rows, overwhelmingly Dutch names
--   (van Oort, van Overbeek, de Ruijter, van Vegchel, Van Leeuwen, ...; one
--   driver's own display name is literally "That Dutch").
-- TL (Timor-Leste) -> PT (Portugal): 14 rows, overwhelmingly Portuguese names
--   (Almeida, Araújo, Azevedo, Semedo; "João" x3).
-- FO (Faroe Islands) -> FI (Finland): 7 rows, overwhelmingly Finnish names
--   (Ruotsalainen x2, Eloranta, Huuskonen, Heinonen).
-- TV (Tuvalu) -> TR (Turkey): 8 rows, overwhelmingly Turkish names (Kaan,
--   Uğur, Bilgehan, Furkan; Dağgül, Kayısı, Kıyak).
-- UM (US Minor Outlying Islands) -> UA (Ukraine): 7 rows, overwhelmingly
--   Ukrainian names (Oleksandr, Yevhen, Kyryll, Kalynovych, Sayko).
-- KG (Kyrgyzstan) -> KR (South Korea): 5 rows, overwhelmingly Korean names.
--   NOTE: KR's pre-existing 5 rows do NOT look Korean at all (Spanish/Italian
--   names) -- KR itself may have been wrong before this merge. Not resolved
--   here; flagged for follow-up.
-- ES (Spain) -> ZA (South Africa): 5 rows, Afrikaans surnames (Pelser,
--   Oosthuizen, Greyling).
-- TM (Turkmenistan) -> TT (Trinidad and Tobago): 2 rows, one driver's own
--   Discord username includes a literal Trinidad & Tobago flag emoji.
-- SO (Somalia) -> RU (Russia): 2 rows, clearly Slavic first+last names
--   (Gleb Kachkaev, Dmitriy Waguri). Lower confidence (small n) but names
--   are unambiguous.
--
-- Explicitly NOT touched in this pass (real signal, but too ambiguous to
-- safely pick a single target code without more to go on): SK (Malaysian/
-- Singaporean names -- MY or SG unclear), VI (generically Hispanic, no
-- specific country), SI (possibly Slovak/Hungarian), SV (mixed), and PL's
-- residual non-Polish-looking rows predating the GW merge.
--
-- Also confirmed CORRECT as-is (were flagged suspicious by the earlier
-- timezone-only check, but names check out): GR (Greek names), BG (Cyrillic
-- Bulgarian name), AM (Armenian surname), PK (Pakistani names). No change.
--
-- Safe to re-run: idempotent (no-ops once no rows remain at the source code).

UPDATE drivers SET country = 'IT' WHERE country = 'CI';
UPDATE drivers SET country = 'NL' WHERE country = 'NZ';
UPDATE drivers SET country = 'PT' WHERE country = 'TL';
UPDATE drivers SET country = 'FI' WHERE country = 'FO';
UPDATE drivers SET country = 'TR' WHERE country = 'TV';
UPDATE drivers SET country = 'UA' WHERE country = 'UM';
UPDATE drivers SET country = 'KR' WHERE country = 'KG';
UPDATE drivers SET country = 'ZA' WHERE country = 'ES';
UPDATE drivers SET country = 'TT' WHERE country = 'TM';
UPDATE drivers SET country = 'RU' WHERE country = 'SO';
