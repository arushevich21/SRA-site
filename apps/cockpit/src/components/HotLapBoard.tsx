import type { HotLapEntry } from '@sra/shared-types';
import { Icon, type IconName } from '@cardog-icons/react';
import { FallbackLogoImage } from './FallbackLogoImage';

// Superset of HotLapEntry — icon fields are optional so AC Evo's raw
// getHotLapBoard() results (which don't carry them) are still assignable
// directly; callers that have resolved an icon (ACC via AccTrackLeaderboard,
// AC Evo's Mazda detection) populate them before passing entries in.
export type HotLapBoardEntry = HotLapEntry & {
  manufacturerIconName?: string | null;
  manufacturerLogoUrl?: string | null;
};

// Times under a minute show as plain seconds (e.g. 34.512); anything a minute
// or longer switches to m:ss.mmm (e.g. 83_456ms → 1:23.456) — long-track
// sectors (Nordschleife etc.) otherwise render as unreadable raw seconds.
function formatSector(ms: number): string {
  if (ms < 60_000) return (ms / 1000).toFixed(3);
  const totalS = Math.floor(ms / 1000);
  const minutes = Math.floor(totalS / 60);
  const seconds = totalS % 60;
  const millis = ms % 1000;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

export function HotLapBoard({ entries }: { entries: HotLapBoardEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="border border-line/50 bg-carbon-2 px-6 py-8 text-center">
        <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3">
          No laps recorded yet for this track
        </p>
      </div>
    );
  }

  const sectorCount = Math.max(0, ...entries.map((e) => e.sectorsMs?.length ?? 0));
  const fastestSector = Array.from({ length: sectorCount }, (_, i) =>
    entries.reduce<number | null>((min, e) => {
      const t = e.sectorsMs?.[i];
      if (t == null) return min;
      return min == null || t < min ? t : min;
    }, null),
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-line">
            <th className="font-mono text-[15px] tracking-[.3em] uppercase text-txt-3 py-2 pr-3 w-8">
              #
            </th>
            <th className="font-mono text-[15px] tracking-[.3em] uppercase text-txt-3 py-2 pr-3">
              Driver
            </th>
            <th className="font-sans text-[15px] text-txt-3 py-2 pr-3 hidden lg:table-cell">
              Car
            </th>
            {Array.from({ length: sectorCount }, (_, i) => (
              <th
                key={i}
                className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 py-2 pl-5 pr-3 w-24 text-right hidden sm:table-cell"
              >
                S{i + 1}
              </th>
            ))}
            <th className="font-mono text-[15px] tracking-[.3em] uppercase text-txt-3 py-2 pl-5 w-28 text-right">
              Lap Time
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.steamId} className="border-b border-line/30">
              <td
                className="font-mono text-[15px] py-2 pr-3"
                style={entry.rank <= 3 ? { color: 'var(--sim-accent)' } : undefined}
              >
                {entry.rank}
              </td>
              <td className="font-display font-bold text-[16px] uppercase text-txt py-2 pr-3 truncate max-w-[220px]">
                {entry.driverName}
              </td>
              <td className="font-sans text-[15px] text-txt-3 py-2 pr-3 hidden lg:table-cell">
                <div className="flex items-center gap-2">
                  <span className="relative w-5 h-5 shrink-0 flex items-center justify-center">
                    {entry.manufacturerIconName ? (
                      <Icon name={entry.manufacturerIconName as IconName} size={18} />
                    ) : (
                      entry.manufacturerLogoUrl && (
                        <FallbackLogoImage src={entry.manufacturerLogoUrl} alt={entry.carModel ?? ''} />
                      )
                    )}
                  </span>
                  <span className="truncate max-w-[500px]">{entry.carModel ?? '—'}</span>
                </div>
              </td>
              {Array.from({ length: sectorCount }, (_, i) => {
                const t = entry.sectorsMs?.[i];
                const isFastest = t != null && fastestSector[i] != null && t === fastestSector[i];
                return (
                  <td
                    key={i}
                    className={[
                      'font-mono text-[15px] py-2 pl-5 pr-3 text-right hidden sm:table-cell',
                      isFastest ? 'text-purple' : undefined,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {t != null ? formatSector(t) : '—'}
                  </td>
                );
              })}
              <td
                className="font-mono text-[15px] py-2 pl-5 text-right"
                style={{ color: 'var(--sim-accent)' }}
              >
                {entry.bestLap}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
