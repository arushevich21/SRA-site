-- Migration: correct drivers.country miscoding — TG->TW
--
-- Same class of bug as prior 20260728 migrations: Taiwan mis-mapped to Togo
-- (TG). Confirmed directly -- Jason Allen (known Taiwanese driver) was coded
-- 'TG'. Corroborated by the rest of the 5-row TG bucket: Chinese/Taiwanese
-- surnames (Wu, Yu, "LIN YI JIE" in surname-first order, Chung), two of them
-- at +08:00 -- Taiwan's real UTC offset.
--
-- Safe to re-run: idempotent (no-ops once no TG rows remain).

UPDATE drivers SET country = 'TW' WHERE country = 'TG';
