// Track lists for ACC seasons that predate the DB-backed championship
// calendar (championship_rounds, S19 onward). The seasonal hot-lap board has
// rows for every track anyone drove on the hot-lap servers that season —
// including spillover that was never a round (S18's 62 laps on the
// Nürburgring 24h layout, S7's few hundred at Barcelona). The seasonal Hot
// Lap / Hot Stint boards and Sweatshop show only the tracks listed here
// (seasonTrackAllowList in lib/seasonal-leaderboard.ts).
//
// Every season ran 8 rounds. Seasons marked "Real schedule" come from the
// Discord announcements; the rest were drafted 2026-10-05 from each season's
// seasonal board, where the rounds stand out at 5k–33k laps from 150–350
// drivers each and everything else is a few hundred laps or less.
//
// Real schedules are written in round order and listed in
// ACC_PAST_SEASONS_IN_ROUND_ORDER, so Sweatshop numbers their weeks; drafted
// lists are alphabetical and show no week numbers. Replace a drafted list as
// its schedule turns up. Values are ACC track_keys (see sim-catalog.ts);
// "Nordschleife" is nurburgring_24h, "Nurb GP" is nurburgring.
export const ACC_PAST_SEASON_TRACKS: Record<string, string[]> = {
  S7: ['donington', 'imola', 'monza', 'paul_ricard', 'silverstone', 'spa', 'valencia', 'watkins_glen'],
  S8: ['cota', 'donington', 'indianapolis', 'misano', 'nurburgring', 'oulton_park', 'watkins_glen', 'zandvoort'],
  S9: ['brands_hatch', 'hungaroring', 'laguna_seca', 'mount_panorama', 'oulton_park', 'suzuka', 'valencia', 'zolder'],
  S10: ['indianapolis', 'kyalami', 'paul_ricard', 'red_bull_ring', 'silverstone', 'snetterton', 'spa', 'valencia'],
  // Real schedule (Discord), in round order: 5/13 – 7/1.
  S11: ['barcelona', 'imola', 'suzuka', 'spa', 'donington', 'nurburgring_24h', 'cota', 'watkins_glen'],
  // Real schedule (Discord), in round order: 9/2 – 10/28, break week 9/30.
  S12: ['paul_ricard', 'laguna_seca', 'silverstone', 'monza', 'red_bull_ring', 'zandvoort', 'brands_hatch', 'kyalami'],
  // Real schedule (Discord), in round order.
  S13: ['suzuka', 'watkins_glen', 'misano', 'nurburgring', 'zolder', 'mount_panorama', 'oulton_park', 'valencia'],
  // Real schedule (Discord), in round order.
  S14: ['indianapolis', 'cota', 'snetterton', 'spa', 'hungaroring', 'red_bull_ring', 'barcelona', 'imola'],
  S15: ['barcelona', 'donington', 'hungaroring', 'kyalami', 'laguna_seca', 'monza', 'nurburgring', 'paul_ricard'],
  S16: ['brands_hatch', 'cota', 'misano', 'mount_panorama', 'silverstone', 'suzuka', 'valencia', 'zandvoort'],
  S17: ['barcelona', 'imola', 'indianapolis', 'kyalami', 'red_bull_ring', 'snetterton', 'watkins_glen', 'zolder'],
  S18: ['cota', 'donington', 'hungaroring', 'laguna_seca', 'monza', 'nurburgring', 'spa', 'suzuka'],
};

// Seasons above listed in real round order (Week 1 first).
export const ACC_PAST_SEASONS_IN_ROUND_ORDER = new Set(['S11', 'S12', 'S13', 'S14']);
