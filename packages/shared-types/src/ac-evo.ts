export type AcEvoSessionType = 'Race' | 'Qualify' | 'Practice';

export type AcEvoDriverResult = {
  position: number;
  driverName: string;
  firstName: string | null;
  lastName: string | null;
  steamId: string;
  nation: string | null;
  carModel: string | null;
  raceNumber: number | null;
  startingPosition: number | null;
  lapsCompleted: number;
  noLaps: boolean;
  bestLapMs: number | null;
  bestLap: string | null;
  sectorsMs: number[] | null; // sector splits, in ms, for the bestLapMs lap
  totalTimeMs?: number;
  qualifyingBestMs?: number | null;
  qualifyingBest?: string | null;
  setValidTime?: boolean;
};

export type AcEvoSessionResult = {
  sessionType: AcEvoSessionType;
  sessionName: string | null;
  track: string;
  trackLayout: string | null;
  serverName: string | null;
  seasonGuid: string | null;
  championshipId: string | null;
  isCompleted: boolean;
  serverStartTime: string | null;
  results: AcEvoDriverResult[];
};

export type EmperorResultListEntry = {
  track: string;
  sessionType: string;
  date: string;
  resultsJsonUrl: string;
};

export type EmperorResultListPage = {
  entries: EmperorResultListEntry[];
  currentPage: number;
  numPages: number;
};

export type EmperorDriverStanding = {
  position: number;
  driverName: string;
  steamId: string;
  carModel: string | null;
  points: number;
  pointsPenalty: number;
  // Teams this driver has been entered under, from Emperor's per-driver
  // `Teams` map. This is the ONLY driver<->team linkage in the standings
  // payload — team rows themselves carry a name and points and nothing else.
  // Usually one; more than one means the driver changed team mid-season
  // (confirmed live on LIAW), and empty means they raced unattached.
  teamNames: string[];
  // Points scored per championship EVENT (Emperor's event id, an opaque uuid),
  // summed across every team the driver scored it under. This is the
  // per-round breakdown behind `points`; an event the driver didn't score is
  // simply absent. Event ids resolve to a round/track through
  // acc_race_sessions.season_id (metaData "championship:<champ>:<event>").
  eventPoints: Record<string, number>;
  // The same points split by the team they were scored under — keyed by
  // team name, then event id. Feeds team-standings round totals; a driver
  // who switched teams mid-season contributes each night to the right one.
  teamEventPoints: Record<string, Record<string, number>>;
  // Events Emperor excluded from `points` — the drop round(s). Still present
  // in eventPoints with their raw score, so a table can show them struck.
  droppedEventIds: string[];
};

export type EmperorTeamStanding = {
  position: number;
  teamName: string;
  points: number;
  pointsPenalty: number;
  // The team's own drop round(s) — Emperor drops the team's worst COMBINED
  // event, which need not be either driver's individual drop.
  droppedEventIds: string[];
};

// Keyed by class name; single-class championships use the "" key Emperor returns.
export type EmperorChampionshipStandings = {
  driverStandings: Record<string, EmperorDriverStanding[]>;
  teamStandings: Record<string, EmperorTeamStanding[]>;
};

export type HotLapEntry = {
  rank: number;
  steamId: string;
  driverName: string;
  carModel: string | null;
  bestLapMs: number;
  bestLap: string;
  sectorsMs: number[] | null;
};
