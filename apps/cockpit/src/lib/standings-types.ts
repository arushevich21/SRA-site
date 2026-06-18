/**
 * TEMPORARY — types for manually-exported SimGrid standings JSON.
 * Will be replaced when packages/domain computes standings natively.
 */

export type ExportedRaceResult = {
  position: number | null;
  pointsGiven: number | null;
  penaltyPoints: number | null;
  pointsTotal: number | null;
  dnf: boolean | null;
  dns: boolean | null;
};

export type ExportedDriverStanding = {
  position: number;
  id: string; // driver display name, NOT a numeric ID
  carNum: number;
  car: string;
  championshipPoints: number;
  championshipPenalties: number;
  championshipScore: number;
  pointsAdjustment: number;
  actualPoints: number;
  races: ExportedRaceResult[];
};

export type ExportedClassGroup = {
  carClass: string;
  standings: ExportedDriverStanding[];
};

export type StandingsExport = ExportedClassGroup[];

export function validateStandingsExport(
  data: unknown,
): { ok: true; data: StandingsExport } | { ok: false; error: string } {
  if (!Array.isArray(data)) {
    return { ok: false, error: 'Top level must be an array' };
  }
  for (let i = 0; i < data.length; i++) {
    const group = data[i];
    if (typeof group?.carClass !== 'string') {
      return { ok: false, error: `Element ${i}: missing or invalid 'carClass'` };
    }
    if (!Array.isArray(group.standings)) {
      return { ok: false, error: `Element ${i}: missing 'standings' array` };
    }
    for (let j = 0; j < group.standings.length; j++) {
      const entry = group.standings[j];
      if (typeof entry?.position !== 'number') {
        return { ok: false, error: `Element ${i}, standing ${j}: missing 'position'` };
      }
      if (typeof entry?.id !== 'string') {
        return { ok: false, error: `Element ${i}, standing ${j}: missing 'id'` };
      }
      if (!Array.isArray(entry?.races)) {
        return { ok: false, error: `Element ${i}, standing ${j}: missing 'races' array` };
      }
    }
  }
  return { ok: true, data: data as StandingsExport };
}
