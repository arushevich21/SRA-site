// When an OBS browser source re-fetches itself. Plain module (no 'use client')
// so the server page and the client refresher read the same numbers — a value
// imported across the client boundary arrives as a reference, not a number.

// A standings page fans out to all seven ACCSM boxes, which allow 5 requests
// per 20s per IP and firewall-ban repeat offenders, and every overlay shares
// Vercel's egress IP with the hot-lap cron that already spends most of that
// budget. Nothing here runs anywhere near a minute by default.
export const DEFAULT_REFRESH_SECONDS = 15 * 60;
export const MIN_REFRESH_SECONDS = 60;
// Booth scenes (commentators, intermission) read only stream_booth and
// drivers — Supabase, never ACCSM — so they can follow the voice channel
// closely: a driver dragged into the booth for an interview is on the card
// within a few seconds. Each tick is two primary-key-sized reads, so even
// four sources across both streams stay well inside Supabase's and Vercel's
// included usage; below ~2s the server round-trips start to overlap and
// Realtime is the right tool instead.
export const BOOTH_REFRESH_SECONDS = 3;
// The race-night lead: refresh this long before the division's green flag, so
// a crew that opened OBS early still gets the new round.
export const PRE_RACE_LEAD_MS = 60 * 60 * 1000;

// `spread` staggers the heartbeat by up to a minute and a half so sources
// that load together don't hit ACCSM in the same window; booth scenes turn
// it off, since a 3s tick with a 90s stagger isn't a 3s tick.
export type OverlayRefreshPlan = { at: string | null; every: number; spread: boolean };
