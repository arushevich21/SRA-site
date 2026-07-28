-- Migration: correct drivers.country miscoding — SY->SE
--
-- Same class of bug as 20260728b/c/d/e (US->UZ, Canada->CM, Mexico->MA,
-- UK->UY, Poland->GW): Sweden mis-mapped to Syria (SY). Confirmed directly —
-- Bryan Anderson (known Swedish driver) was coded 'SY'. Corroborated by two
-- other rows in the same 8-row SY bucket carrying distinctly Swedish
-- surnames (Alex Carlsson, Oliwer Sjögren). As with GW->PL, timezone data
-- alone doesn't cleanly confirm this pairing (the bucket is scattered across
-- North American and European offsets), so this rests on the direct/name
-- evidence, not a timezone cluster.
--
-- Safe to re-run: idempotent (no-ops once no SY rows remain).

UPDATE drivers SET country = 'SE' WHERE country = 'SY';
