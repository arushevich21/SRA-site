'use client';

import { useState } from 'react';
import { msToLaptime } from '@sra/domain';
import type { AcEvoSessionResult } from '@sra/shared-types';
import { fetchAcEvoRaceResult, type RaceResultFetch } from '@/app/[sim]/standings/actions';

type Round = { round: number; track: string; trackKey: string };

export function AcEvoRaceResultsTabs({ rounds }: { rounds: Round[] }) {
  const [activeRound, setActiveRound] = useState<number | null>(null);
  const [cache, setCache] = useState<Record<number, RaceResultFetch>>({});
  const [loading, setLoading] = useState<number | null>(null);

  async function selectRound(round: Round) {
    setActiveRound(round.round);
    if (cache[round.round]) return;

    setLoading(round.round);
    const result = await fetchAcEvoRaceResult(round.trackKey);
    setCache((prev) => ({ ...prev, [round.round]: result }));
    setLoading(null);
  }

  const active = activeRound != null ? cache[activeRound] : undefined;

  return (
    <div className="mt-14">
      <p className="font-mono text-[15px] tracking-[.25em] uppercase text-txt-3 mb-4">
        Race Results by Round
      </p>
      <div className="flex gap-1 border-b border-line mb-4 flex-wrap">
        {rounds.map((r) => (
          <button
            key={r.round}
            type="button"
            onClick={() => selectRound(r)}
            className={[
              'font-mono text-[13px] tracking-[.2em] uppercase px-4 py-2 -mb-px border-b-2 transition-colors cursor-pointer',
              activeRound === r.round
                ? 'text-gold border-gold'
                : 'text-txt-3 border-transparent hover:text-txt-2',
            ].join(' ')}
          >
            R{r.round}
          </button>
        ))}
      </div>

      {activeRound == null && (
        <p className="font-mono text-[12px] text-txt-3 py-6 text-center">
          Select a round to see that race&apos;s results in finishing order.
        </p>
      )}

      {activeRound != null && loading === activeRound && (
        <p className="font-mono text-[12px] text-txt-3 py-6 text-center">Loading…</p>
      )}

      {active && !active.ok && (
        <p className="font-mono text-[12px] text-txt-3 py-6 text-center">
          Couldn&apos;t load this round&apos;s results — try again shortly.
        </p>
      )}

      {active && active.ok && !active.data && (
        <p className="font-mono text-[12px] text-txt-3 py-6 text-center">
          No race results found for this round yet.
        </p>
      )}

      {active && active.ok && active.data && <RaceResultTable session={active.data} />}
    </div>
  );
}

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function RaceResultTable({ session }: { session: AcEvoSessionResult }) {
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
            <th className="font-mono text-[13px] tracking-[.3em] uppercase text-txt-3 py-2 pl-5 text-right hidden sm:table-cell">
              Total Time
            </th>
          </tr>
        </thead>
        <tbody>
          {session.results.map((r) => {
            const isFastestLap = fastestLapMs != null && r.bestLapMs === fastestLapMs;
            return (
              <tr key={r.steamId || r.driverName} className="border-b border-line/30">
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
                  {r.driverName}
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
                  title={isFastestLap ? 'Fastest lap of the race' : undefined}
                >
                  {r.bestLap ?? '—'}
                </td>
                <td className="font-mono text-[13px] text-txt-2 py-2 pl-5 text-right hidden sm:table-cell">
                  {r.totalTimeMs ? msToLaptime(r.totalTimeMs) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
