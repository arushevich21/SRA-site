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
