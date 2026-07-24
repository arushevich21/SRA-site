-- Migration: per-round hot-lap release flag for the Seasonal leaderboard.
-- Admins flip this per round (week to week) in the events admin to publish that
-- race's hot-lap board. The Seasonal leaderboard (ACC / accsm1-7 championships)
-- shows a round's board only when hotlap_released is true — default false keeps
-- upcoming/unreleased rounds hidden. Idempotent.

ALTER TABLE championship_rounds
  ADD COLUMN IF NOT EXISTS hotlap_released boolean NOT NULL DEFAULT false;
