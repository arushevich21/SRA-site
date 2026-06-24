'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { StandingsExport } from '../lib/standings-types';
import { ClassGroupTable } from './ClassGroupTable';

const DIVISIONS = [1, 2, 3, 4] as const;
const CHAMP_TYPES = ['Drivers', 'Teams'] as const;

type ChampType = (typeof CHAMP_TYPES)[number];
type DriverView = 'overall' | 'gold' | 'silver';

type DivisionData = {
  drivers: StandingsExport | null;
  teams: StandingsExport | null;
};

export function GT3TeamStandings({
  data,
}: {
  data: Record<number, DivisionData>;
}) {
  const [division, setDivision] = useState<number>(1);
  const [champType, setChampType] = useState<ChampType>('Drivers');
  const [driverView, setDriverView] = useState<DriverView>('overall');

  const divData = data[division];
  const driverStandings = divData?.drivers;
  const teamStandings = divData?.teams;

  const goldGroup = driverStandings?.find((g) =>
    g.carClass.toLowerCase().includes('gold'),
  );
  const silverGroup = driverStandings?.find((g) =>
    g.carClass.toLowerCase().includes('silver'),
  );

  const badgeSuffix =
    champType === 'Drivers' && driverView === 'gold'
      ? ' Gold'
      : champType === 'Drivers' && driverView === 'silver'
        ? ' Silver'
        : '';

  return (
    <div>
      {/* Division selector with badge */}
      <div className="flex items-center gap-4 mb-6">
        <Image
          src={`/badges/Division ${division}${badgeSuffix}.png`}
          alt={`Division ${division}${badgeSuffix}`}
          width={48}
          height={48}
          className="w-[44px] h-[44px] shrink-0 object-contain"
        />
        <div className="flex gap-2">
          {DIVISIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDivision(d)}
              className={[
                'font-mono text-[12px] tracking-[.2em] uppercase px-4 py-2 border transition-colors cursor-pointer',
                d === division
                  ? 'text-gold border-gold bg-gold/5'
                  : 'text-txt-3 border-line hover:text-txt-2 hover:border-line-2',
              ].join(' ')}
            >
              D{d}
            </button>
          ))}
        </div>
      </div>

      {/* Championship type tabs */}
      <div className="flex gap-1 border-b border-line mb-6">
        {CHAMP_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setChampType(type)}
            className={[
              'font-mono text-[11px] tracking-[.25em] uppercase px-4 py-2 -mb-px border-b-2 transition-colors cursor-pointer',
              type === champType
                ? 'text-gold border-gold'
                : 'text-txt-3 border-transparent hover:text-txt-2',
            ].join(' ')}
          >
            {type === 'Drivers' ? 'Drivers Championship' : 'Team Championship'}
          </button>
        ))}
      </div>

      {/* Content */}
      {champType === 'Drivers' ? (
        driverStandings && driverStandings.length > 0 ? (
          <div>
            {/* Overall / Gold / Silver filter */}
            <div className="flex gap-1 mb-4">
              {(['overall', 'gold', 'silver'] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setDriverView(view)}
                  className={[
                    'font-mono text-[11px] tracking-[.2em] uppercase px-3 py-1.5 border transition-colors cursor-pointer',
                    view === driverView
                      ? 'text-gold border-gold bg-gold/5'
                      : 'text-txt-3 border-line hover:text-txt-2',
                  ].join(' ')}
                >
                  {view === 'overall' ? 'Overall' : view === 'gold' ? `D${division} Gold` : `D${division} Silver`}
                </button>
              ))}
            </div>

            {driverView === 'overall' ? (
              <div className="flex flex-col gap-8">
                {driverStandings.map((group) => (
                  <ClassGroupTable key={group.carClass} group={group} />
                ))}
              </div>
            ) : driverView === 'gold' && goldGroup ? (
              <ClassGroupTable group={goldGroup} />
            ) : driverView === 'silver' && silverGroup ? (
              <ClassGroupTable group={silverGroup} />
            ) : (
              <NoData />
            )}
          </div>
        ) : (
          <NoData />
        )
      ) : teamStandings && teamStandings.length > 0 ? (
        <ClassGroupTable group={teamStandings[0]} />
      ) : (
        <NoData />
      )}
    </div>
  );
}

function NoData() {
  return (
    <div className="border border-gold-deep/30 bg-gold-deep/5 px-5 py-4">
      <p className="font-mono text-[11px] tracking-[.15em] uppercase text-gold-deep">
        No standings data yet
      </p>
      <p className="font-sans text-[12px] text-txt-3 mt-1">
        Standings will be available once Season 19 begins.
      </p>
    </div>
  );
}
