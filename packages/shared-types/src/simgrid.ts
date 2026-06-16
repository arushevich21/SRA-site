/**
 * Minimal championship shape returned by GET /championships (list).
 * The list endpoint only returns { id, name } per item.
 */
export type SimGridChampionshipSummary = {
  id: number;
  name: string;
};

/**
 * Full championship returned by GET /championships/:id.
 * races is always present in this response (confirmed from fixture).
 * endDate may be null when the championship has no scheduled end.
 */
export type SimGridChampionship = {
  id: number;
  name: string;
  startDate: string;        // ISO datetime — API: start_date
  endDate: string | null;   // API: end_date (null when not yet set)
  capacity: number;
  spotsTaken: number;       // API: spots_taken
  teamsEnabled: boolean;    // API: teams_enabled
  url: string;
  resultsUrl: string;       // API: results_url
  races: SimGridRace[];     // always embedded in :id response
};

/**
 * Track metadata embedded in every race object.
 * The raw API field is race.track (an object, not a string).
 * inGameName is the ACC internal track slug (e.g. "red_bull_ring") —
 * useful for cross-referencing with game data.
 */
export type SimGridTrack = {
  id: number;
  name: string;        // human-readable name, e.g. "Red Bull Ring"
  inGameName: string;  // API: in_game_name — ACC internal slug
};

/**
 * Normalized race. Embedded in SimGridChampionship.races
 * and returned as the body of GET /races/:id.
 */
export type SimGridRace = {
  id: number;
  name: string;               // API: race_name
  displayName: string;        // API: display_name
  track: SimGridTrack;        // API: track (nested object, not a string)
  startsAt: string;           // ISO datetime — API: starts_at
  resultsAvailable: boolean;  // API: results_available
  ended: boolean;
  publishedAt: string | null; // API: published_at
};

/**
 * One entry from GET /championships/:id/standings.
 * The raw response is a 5-element mixed array; simgrid-client
 * extracts element [0] (the TeamEntry array) at the boundary.
 * Callers receive SimGridStandingsEntry[], never the raw envelope.
 */
export type SimGridStandingsEntry = {
  id: number;
  teamId: number;                    // API: team_id
  displayName: string;               // API: display_name
  active: boolean;
  participatingDriverIds: number[];  // API: participating_driver_ids
  driverPoolIds: number[];           // API: driver_pool_ids
};

/**
 * Typed error thrown by GridOSClient for every failure path.
 * status = 0 means a network-level error (DNS, timeout, refused).
 * endpoint is the URL path (e.g. /championships/9622) for diagnostics.
 * Callers catch GridOSError; raw fetch errors never escape the client.
 */
export class GridOSError extends Error {
  constructor(
    readonly status: number,
    readonly endpoint: string,
    message: string,
  ) {
    super(message);
    this.name = 'GridOSError';
  }
}
