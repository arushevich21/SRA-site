'use client';

import { useEffect, useState } from 'react';
import { msToLaptime } from '@sra/domain';
import type { AcEvoDriverResult, AcEvoSessionResult } from '@sra/shared-types';
import {
  fetchAcEvoRaceResult,
  fetchAcEvoQualifyResult,
  type RaceResultFetch,
} from '@/app/[sim]/standings/actions';
import { DriverTierBadge } from './DriverTierBadge';
import type { DriverInfo } from '@/lib/driver-lookup';

type Tab = 'Race' | 'Qualify';
const TAB_ORDER: Tab[] = ['Race', 'Qualify'];
const TAB_LABEL: Record<Tab, string> = { Race: 'Race', Qualify: 'Qualifying' };
const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

const FETCHER: Record<Tab, (trackKey: string) => Promise<RaceResultFetch>> = {
  Race: fetchAcEvoRaceResult,
  Qualify: fetchAcEvoQualifyResult,
};

// One session type is fetched at a time, on demand — Race up front (the
// default tab), Qualify only if the user actually switches to it. Each fetch
// can cost several requests against Emperor's real ~2 req/min limit, so
// fetching both eagerly on every page view isn't viable; see
// lib/acevo-race-results.ts.
export function AcEvoResultsTabs({ trackKey }: { trackKey: string }) {
  const [active, setActive] = useState<Tab>('Race');
  const [cache, setCache] = useState<Partial<Record<Tab, RaceResultFetch>>>({});
  const [loading, setLoading] = useState<Tab | null>('Race');

  async function load(tab: Tab, key: string) {
    setLoading(tab);
    const result = await FETCHER[tab](key);
    setCache((prev) => ({ ...prev, [tab]: result }));
    setLoading(null);
  }

  useEffect(() => {
    setCache({});
    setActive('Race');
    void load('Race', trackKey);
  }, [trackKey]);

  function selectTab(tab: Tab) {
    setActive(tab);
    if (!cache[tab]) void load(tab, trackKey);
  }

  const current = cache[active];

  return (
    <div>
      <div className="flex gap-1 border-b border-line mb-4 flex-wrap">
        {TAB_ORDER.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => selectTab(tab)}
            className={[
              'font-mono text-[13px] tracking-[.2em] uppercase px-4 py-2 -mb-px border-b-2 transition-colors cursor-pointer',
              active === tab ? 'text-gold border-gold' : 'text-txt-3 border-transparent hover:text-txt-2',
            ].join(' ')}
          >
            {TAB_LABEL[tab]}
          </button>
        ))}
      </div>

      {loading === active && (
        <p className="font-mono text-[12px] text-txt-3 py-6 text-center">Loading…</p>
      )}

      {loading !== active && current && !current.ok && (
        <p className="font-mono text-[12px] text-txt-3 py-6 text-center">
          Couldn&apos;t load {TAB_LABEL[active].toLowerCase()} results — try again shortly.
        </p>
      )}

      {loading !== active && current && current.ok && !current.data && (
        <p className="font-mono text-[12px] text-txt-3 py-6 text-center">
          No {TAB_LABEL[active].toLowerCase()} results found for this round yet.
        </p>
      )}

      {loading !== active && current && current.ok && current.data && (
        <ResultTable session={current.data} driverInfo={current.driverInfo} />
      )}
    </div>
  );
}

function ResultTable({
  session,
  driverInfo,
}: {
  session: AcEvoSessionResult;
  driverInfo: Record<string, DriverInfo>;
}) {
  const isRace = session.sessionType === 'Race';
  const fastestLapMs = session.results.reduce<number | null>((fastest, r) => {
    if (r.bestLapMs == null) return fastest;
    return fastest == null || r.bestLapMs < fastest ? r.bestLapMs : fastest;
  }, null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-line">
            <th className="font-mono text-[13px] tracking-[.3em] uppercase text-txt-3 py-2 pr-3 w-8">P</th>
            <th className="font-mono text-[13px] tracking-[.3em] uppercase text-txt-3 py-2 pr-3">Driver</th>
            <th className="font-sans text-[13px] text-txt-3 py-2 pr-3 hidden lg:table-cell">Car</th>
            <th className="font-mono text-[13px] tracking-[.3em] uppercase text-txt-3 py-2 pl-5 text-right">
              Best Lap
            </th>
            {isRace && (
              <th className="font-mono text-[13px] tracking-[.3em] uppercase text-txt-3 py-2 pl-5 text-right hidden sm:table-cell">
                Total Time
              </th>
            )}
            <th className="font-mono text-[13px] tracking-[.3em] uppercase text-txt-3 py-2 pl-5 text-right hidden md:table-cell">
              Laps
            </th>
          </tr>
        </thead>
        <tbody>
          {session.results.map((r) => (
            <ResultRow
              key={r.steamId || r.driverName}
              r={r}
              isRace={isRace}
              fastestLapMs={fastestLapMs}
              info={r.steamId ? driverInfo[r.steamId] : undefined}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultRow({
  r,
  isRace,
  fastestLapMs,
  info,
}: {
  r: AcEvoDriverResult;
  isRace: boolean;
  fastestLapMs: number | null;
  info: DriverInfo | undefined;
}) {
  const isFastestLap = fastestLapMs != null && r.bestLapMs === fastestLapMs;

  return (
    <tr className="border-b border-line/30">
      <td
        className="font-mono text-[14px] py-2 pr-3"
        style={r.position <= 3 ? { color: 'var(--sim-accent)' } : undefined}
      >
        <span className="inline-flex items-center gap-1.5">
          {r.position}
          {MEDALS[r.position] && <span aria-hidden="true">{MEDALS[r.position]}</span>}
        </span>
      </td>
      <td className="font-display font-bold text-[15px] uppercase text-txt py-2 pr-3 truncate max-w-[220px]">
        <span className="inline-flex items-center gap-2">
          {info && <DriverTierBadge isSralien={info.isSralien} division={info.division} tier={info.tier} />}
          {r.driverName}
        </span>
      </td>
      <td className="font-sans text-[13px] text-txt-3 py-2 pr-3 truncate max-w-[200px] hidden lg:table-cell">
        {r.carModel ?? '—'}
      </td>
      <td
        className={[
          'font-mono text-[13px] py-2 pl-5 text-right',
          isFastestLap ? 'font-bold' : 'text-txt-2',
        ].join(' ')}
        style={isFastestLap ? { color: 'var(--color-purple)' } : undefined}
        title={isFastestLap ? 'Fastest lap of the session' : undefined}
      >
        {r.bestLap ?? '—'}
      </td>
      {isRace && (
        <td className="font-mono text-[13px] text-txt-2 py-2 pl-5 text-right hidden sm:table-cell">
          {r.totalTimeMs ? msToLaptime(r.totalTimeMs) : '—'}
        </td>
      )}
      <td className="font-mono text-[13px] text-txt-2 py-2 pl-5 text-right hidden md:table-cell">
        {r.lapsCompleted}
      </td>
    </tr>
  );
}
