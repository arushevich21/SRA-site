export type AccSessionType = 'Practice' | 'Qualify' | 'Race';

export type AccDriverEntry = {
  firstName: string | null;
  lastName: string | null;
  steamId: string; // playerId with the leading "S" stripped
  shortName: string | null;
};

export type AccDriverResult = {
  position: number;
  carId: number;
  carModel: number; // raw numeric ID — see IX.3 in the Server Admin Handbook
  carModelName: string | null; // resolved name, null if not in the lookup table
  carGroup: string | null;
  cupCategory: number | null; // raw numeric ID — see IX.5
  cupCategoryName: string | null;
  raceNumber: number | null;
  teamName: string | null;
  drivers: AccDriverEntry[]; // more than one entry for multi-driver/endurance cars
  currentDriverSteamId: string | null; // who was driving at session end
  lapsCompleted: number;
  bestLapMs: number | null;
  bestLap: string | null;
  sectorsMs: number[] | null; // sector splits, in ms, for the bestLapMs lap
  lastLapMs: number | null;
  totalTimeMs: number | null;
  missingMandatoryPitstop: boolean | null; // null when not applicable (FP/Q)
};

export type AccSessionResult = {
  sessionType: AccSessionType;
  track: string;
  serverName: string | null;
  date: string | null;
  sessionFile: string | null;
  championshipId: string | null;
  seasonId: string | null;
  isWetSession: boolean;
  bestLapMs: number | null; // session-wide fastest lap
  bestLap: string | null;
  bestSplits: number[] | null; // session-wide fastest sectors
  results: AccDriverResult[]; // already in finishing/session order
};
