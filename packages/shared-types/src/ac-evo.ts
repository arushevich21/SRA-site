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
};

export type EmperorTeamStanding = {
  position: number;
  teamName: string;
  points: number;
  pointsPenalty: number;
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
