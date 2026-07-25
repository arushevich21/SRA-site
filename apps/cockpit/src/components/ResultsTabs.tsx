'use client';

import { useState } from 'react';
import { Icon, type IconName } from '@cardog-icons/react';
import { accCarManufacturerIconName, accCarManufacturerLogoUrl } from '@sra/domain';
import type { AccDriverResult, AccSessionResult, AccSessionType } from '@sra/shared-types';
import { FallbackLogoImage } from './FallbackLogoImage';

const TAB_ORDER: AccSessionType[] = ['Race', 'Qualify', 'Practice'];
const TAB_LABEL: Record<AccSessionType, string> = {
  Race: 'Race',
  Qualify: 'Qualifying',
  Practice: 'Practice',
};

// Prefer the curated local icon (@cardog-icons/react); fall back to the CDN
// logo guess only for manufacturers that library doesn't cover at all — same
// precedence as AccTrackLeaderboard's toHotLapEntry.
function carIcon(carModel: number): { iconName: string | null; logoUrl: string | null } {
  const iconName = accCarManufacturerIconName(carModel);
  const logoUrl = !iconName ? accCarManufacturerLogoUrl(carModel) : null;
  return { iconName, logoUrl };
}

function driverDisplayName(result: AccDriverResult): string {
  const driver =
    result.drivers.find((d) => d.steamId === result.currentDriverSteamId) ?? result.drivers[0];
  if (!driver) return 'Unknown';
  const fullName = [driver.firstName, driver.lastName].filter(Boolean).join(' ');
  return fullName || driver.shortName || 'Unknown';
}

export function ResultsTabs({ sessions }: { sessions: AccSessionResult[] }) {
  const bySessionType = new Map(sessions.map((s) => [s.sessionType, s]));
  const availableTabs = TAB_ORDER.filter((t) => bySessionType.has(t));
  const [active, setActive] = useState<AccSessionType | null>(availableTabs[0] ?? null);

  if (availableTabs.length === 0 || active == null) {
    return (
      <p className="font-mono text-[12px] text-txt-3 py-6 text-center">
        No session data for this event.
      </p>
    );
  }

  const session = bySessionType.get(active)!;

  return (
    <div>
      <div className="flex gap-1 border-b border-line mb-4 flex-wrap">
        {availableTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActive(tab)}
            className={[
              'font-mono text-[13px] tracking-[.2em] uppercase px-4 py-2 -mb-px border-b-2 transition-colors cursor-pointer',
              active === tab ? 'text-gold border-gold' : 'text-txt-3 border-transparent hover:text-txt-2',
            ].join(' ')}
          >
            {TAB_LABEL[tab]}
          </button>
        ))}
      </div>
      <ResultsTable session={session} />
    </div>
  );
}

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function ResultsTable({ session }: { session: AccSessionResult }) {
  const isRace = session.sessionType === 'Race';

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-line">
            <th className="font-mono text-[15px] tracking-[.3em] uppercase text-txt-3 py-2 pr-3 w-8">P</th>
            <th className="font-mono text-[15px] tracking-[.3em] uppercase text-txt-3 py-2 pr-3">Driver</th>
            <th className="font-sans text-[15px] text-txt-3 py-2 pr-3 hidden lg:table-cell">Car</th>
            {isRace && (
              <th className="font-mono text-[15px] tracking-[.3em] uppercase text-txt-3 py-2 pl-5 text-right hidden sm:table-cell">
                Total Time
              </th>
            )}
            <th className="font-mono text-[15px] tracking-[.3em] uppercase text-txt-3 py-2 pl-5 text-right">
              Best Lap
            </th>
            <th className="font-mono text-[15px] tracking-[.3em] uppercase text-txt-3 py-2 pl-5 text-right hidden md:table-cell">
              Avg Clean Lap
            </th>
            <th className="font-mono text-[15px] tracking-[.3em] uppercase text-txt-3 py-2 pl-5 text-right">
              Laps
            </th>
          </tr>
        </thead>
        <tbody>
          {session.results.map((r) => {
            const { iconName, logoUrl } = carIcon(r.carModel);
            const isFastestRaceLap = isRace && r.bestLapMs != null && r.bestLapMs === session.bestLapMs;
            return (
              <tr key={`${r.carId}-${r.position}`} className="border-b border-line/30">
                <td
                  className={[
                    'font-mono text-[15px] py-2 pr-3',
                    r.position <= 3 ? 'text-gold' : 'text-txt',
                  ].join(' ')}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {r.position}
                    {MEDALS[r.position] && <span aria-hidden="true">{MEDALS[r.position]}</span>}
                  </span>
                </td>
                <td className="font-display font-bold text-[15px] uppercase text-txt py-2 pr-3 truncate max-w-[220px]">
                  {driverDisplayName(r)}
                </td>
                <td className="font-sans text-[15px] text-txt-3 py-2 pr-3 truncate max-w-[200px] hidden lg:table-cell">
                  <div className="flex items-center gap-2">
                    <span className="relative w-5 h-5 shrink-0 flex items-center justify-center">
                      {iconName ? (
                        <Icon name={iconName as IconName} size={18} />
                      ) : (
                        logoUrl && <FallbackLogoImage src={logoUrl} alt={r.carModelName ?? ''} />
                      )}
                    </span>
                    <span className="truncate">{r.carModelName ?? '—'}</span>
                  </div>
                </td>
                {isRace && (
                  <td className="font-mono text-[15px] text-txt-2 py-2 pl-5 text-right hidden sm:table-cell">
                    {r.totalTimeMs != null ? msToClock(r.totalTimeMs) : '—'}
                  </td>
                )}
                <td
                  className={['font-mono text-[15px] py-2 pl-5 text-right', isFastestRaceLap ? 'font-bold' : 'text-txt-2'].join(
                    ' ',
                  )}
                  style={isFastestRaceLap ? { color: 'var(--color-purple)' } : undefined}
                  title={isFastestRaceLap ? 'Fastest lap of the race' : undefined}
                >
                  {r.bestLap ?? '—'}
                </td>
                <td className="font-mono text-[15px] text-txt-2 py-2 pl-5 text-right hidden md:table-cell">
                  {r.avgCleanLap ?? '—'}
                </td>
                <td className="font-mono text-[15px] text-txt-2 py-2 pl-5 text-right">{r.lapsCompleted}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Race total times can run past an hour (endurance formats), unlike a single
// lap — format as h:mm:ss rather than the lap-time m:ss.mmm format.
function msToClock(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = minutes.toString().padStart(hours > 0 ? 2 : 1, '0');
  const ss = seconds.toString().padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
