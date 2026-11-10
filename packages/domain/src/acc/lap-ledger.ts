// ACC lap ledger — per-session, per-driver lap counts behind the site's live
// lap/session counters, the All-Time Laps board and profile mileage (see
// supabase/migrations/20261012_acc_lap_ledger_and_site_stats.sql).
//
// MIRRORED in SRA-Bot's app/util/lap_ledger.py, which records the same
// sessions from disk. Both writers must derive the same file key and count
// laps the same way, or the ledger double-counts / disagrees — change both.

// ── raw API shapes — private, never exported ────────────────────────────────

type RawDriver = { playerId?: string; firstName?: string; lastName?: string };
type RawLine = { car?: { carId?: number; carModel?: number; drivers?: RawDriver[] }; currentDriverIndex?: number };
type RawLap = { carId?: number; driverIndex?: number; isValidForBest?: boolean };

export type AccLedgerDriverLaps = {
  steamId: string; // S-prefixed playerId, as every acc_* table stores it
  carModelId: number;
  driverName: string;
  laps: number;
  validLaps: number;
};

// Every lap in the flat `laps` log is attributed to car.drivers[lap.driverIndex]
// — who actually drove it — so shared endurance cars split correctly; an
// out-of-range index falls back to the line's current driver. Every car
// counts (no class filter) and wet sessions count. Laps from a carId with no
// leaderboard line, or a driver with no playerId, can't be attributed and are
// dropped.
export function extractAccDriverLaps(raw: unknown): AccLedgerDriverLaps[] {
  if (!raw || typeof raw !== 'object') return [];
  const session = raw as { laps?: RawLap[]; sessionResult?: { leaderBoardLines?: RawLine[] } };

  const cars = new Map<number, { model: number; drivers: RawDriver[]; current: number }>();
  for (const l of session.sessionResult?.leaderBoardLines ?? []) {
    const car = l.car;
    if (car?.carId == null || car.carModel == null) continue;
    cars.set(car.carId, { model: car.carModel, drivers: car.drivers ?? [], current: l.currentDriverIndex ?? 0 });
  }

  const out = new Map<string, AccLedgerDriverLaps>();
  for (const lap of session.laps ?? []) {
    const car = lap.carId == null ? undefined : cars.get(lap.carId);
    if (!car) continue;
    const idx = lap.driverIndex;
    const driver =
      idx != null && idx >= 0 && idx < car.drivers.length ? car.drivers[idx] : car.drivers[car.current];
    const steamId = driver?.playerId;
    if (!steamId) continue;

    const key = `${steamId}:${car.model}`;
    let row = out.get(key);
    if (!row) {
      row = {
        steamId,
        carModelId: car.model,
        driverName: `${driver.firstName ?? ''} ${driver.lastName ?? ''}`.trim(),
        laps: 0,
        validLaps: 0,
      };
      out.set(key, row);
    }
    row.laps++;
    if (lap.isValidForBest) row.validLaps++;
  }
  return [...out.values()];
}

const EMPEROR_RESULT_URL = /^\/server\/(\d+)\/results\/download\/(\d{6}_\d{6}_[A-Za-z0-9]+)\.json$/;

// Canonical ledger key, '<source>:server_<N>/<stem>'. Emperor's /server/N/
// is the same server as the disk's servers/server_N/ — verified on all 1,015
// sessions both paths had already ingested — so this equals what SRA-Bot
// derives from the file's path and the session is recorded once.
export function accLedgerFileKeyFromEmperorUrl(source: string, resultsJsonUrl: string): string | null {
  const m = EMPEROR_RESULT_URL.exec(resultsJsonUrl);
  return m ? `${source}:server_${m[1]}/${m[2]}` : null;
}

// Only hosts the ledger's check constraint knows. accsm3-7 are retired.
const LEDGER_SOURCES = new Set(['accsm1', 'accsm2']);

export function accLedgerSourceFromBaseUrl(baseUrl: string): 'accsm1' | 'accsm2' | null {
  const host = /^https?:\/\/(accsm\d+)\./.exec(baseUrl)?.[1];
  return host && LEDGER_SOURCES.has(host) ? (host as 'accsm1' | 'accsm2') : null;
}

const RESULT_STAMP = /^(\d{2})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})_[A-Za-z0-9]+(?:\.json)?$/;

// ACC stamps result names in server-local time with no zone; read as UTC,
// same as SRA-Bot, so both writers store the same session_at.
export function accSessionAtFromFileName(name: string): Date | null {
  const m = RESULT_STAMP.exec(name);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
  const at = new Date(Date.UTC(2000 + y, mo - 1, d, h, mi, s));
  // Date.UTC rolls over impossible values (month 13 -> next year); reject those.
  if (at.getUTCMonth() !== mo - 1 || at.getUTCDate() !== d || at.getUTCHours() !== h) return null;
  return at;
}

// ── qualifying (Pole Positions) ─────────────────────────────────────────────

export type AccQualifyingLine = {
  position: number; // leaderboard order, 1 = pole
  steamId: string; // S-prefixed, like the ledger
  bestLapMs: number | null; // null = no valid lap (can't hold pole)
};

const NO_TIME = 2_147_483_647; // ACC's int32-max "no lap" sentinel

type RawQualifyingLine = RawLine & { timing?: { bestLap?: number } };

// A qualifying file's leaderboard, in ACC's own order (it already ranks by
// best lap — trust it, as parseAccSession does), credited to each line's
// current driver. Not a qualifying session → []. Lines with no playerId are
// skipped but keep their position slot, so P1 is only ever the real P1.
export function extractAccQualifying(raw: unknown): AccQualifyingLine[] {
  if (!raw || typeof raw !== 'object') return [];
  const session = raw as { sessionType?: string; sessionResult?: { leaderBoardLines?: RawQualifyingLine[] } };
  if (!/^Q/i.test(session.sessionType ?? '')) return [];

  const out: AccQualifyingLine[] = [];
  (session.sessionResult?.leaderBoardLines ?? []).forEach((l, idx) => {
    const drivers = l.car?.drivers ?? [];
    const steamId = drivers[l.currentDriverIndex ?? 0]?.playerId;
    if (!steamId) return;
    const best = l.timing?.bestLap;
    out.push({
      position: idx + 1,
      steamId,
      bestLapMs: typeof best === 'number' && best > 0 && best < NO_TIME ? best : null,
    });
  });
  return out;
}
