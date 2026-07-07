'use client';

import { useState } from 'react';

export type Member = {
  driver_id: string;
  display_name: string | null;
  tier: 'gold' | 'silver' | null;
};

export type Team = {
  id: string;
  team_name: string;
  car: string;
  division_id: number;
  division_name: string;
  members: Member[];
};

type Tab = 'all' | 1 | 2 | 3 | 4 | 'breakdown';

const DIVISIONS = [1, 2, 3, 4] as const;

export default function TeamList({
  teams,
  maxTeamSize,
}: {
  teams: Team[];
  maxTeamSize: number;
}) {
  const [tab, setTab] = useState<Tab>('all');

  const totalMembers = teams.reduce((s, t) => s + t.members.length, 0);
  const totalSlots = teams.length * maxTeamSize;

  const divStats = DIVISIONS.map((d) => {
    const divTeams = teams.filter((t) => t.division_id === d);
    return {
      div: d,
      teams: divTeams.length,
      members: divTeams.reduce((s, t) => s + t.members.length, 0),
    };
  });

  const visibleTeams =
    tab === 'all' || tab === 'breakdown'
      ? teams
      : teams.filter((t) => t.division_id === (tab as number));

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <StatBox
          label="Total Teams"
          value={String(teams.length)}
        />
        <StatBox
          label="Drivers"
          value={totalSlots > 0 ? `${totalMembers} / ${totalSlots}` : String(totalMembers)}
          sub={totalSlots > 0 ? `${Math.round((totalMembers / totalSlots) * 100)}% filled` : undefined}
        />
        {divStats.map((ds) => (
          <StatBox
            key={ds.div}
            label={`Division ${ds.div}`}
            value={`${ds.teams} teams`}
            sub={`${ds.members} drivers`}
          />
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-line overflow-x-auto">
        {(['all', 1, 2, 3, 4, 'breakdown'] as Tab[]).map((t) => (
          <button
            key={String(t)}
            onClick={() => setTab(t)}
            className={[
              'font-mono text-[10px] tracking-[.2em] uppercase px-5 py-3 border-r border-line whitespace-nowrap transition-colors shrink-0',
              tab === t ? 'bg-panel-2 text-txt' : 'text-txt-3 hover:text-txt',
            ].join(' ')}
          >
            {t === 'all'
              ? 'All Teams'
              : t === 'breakdown'
                ? 'Breakdown'
                : `Div ${t}`}
          </button>
        ))}
      </div>

      {tab === 'breakdown' ? (
        <BreakdownTable teams={teams} />
      ) : (
        <div className="border border-line border-t-0">
          {visibleTeams.length === 0 ? (
            <p className="font-mono text-[12px] text-txt-3 px-5 py-6">
              No teams registered yet.
            </p>
          ) : (
            visibleTeams.map((team, i) => (
              <TeamRow
                key={team.id}
                team={team}
                maxTeamSize={maxTeamSize}
                stripe={i % 2 === 1}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="border border-line bg-panel px-4 py-3">
      <p className="font-mono text-[9px] tracking-[.3em] uppercase text-txt-3 mb-1">
        {label}
      </p>
      <p className="font-mono text-[17px] font-bold text-txt leading-tight">
        {value}
      </p>
      {sub && (
        <p className="font-mono text-[10px] text-txt-3 mt-0.5">{sub}</p>
      )}
    </div>
  );
}

function TeamRow({
  team,
  maxTeamSize,
  stripe,
}: {
  team: Team;
  maxTeamSize: number;
  stripe: boolean;
}) {
  const spotsOpen = maxTeamSize - team.members.length;
  return (
    <div
      className={[
        'flex items-center gap-4 px-5 py-3 border-b border-line/30 last:border-b-0 flex-wrap',
        stripe ? 'bg-panel-2/20' : '',
      ].join(' ')}
    >
      {/* Team + car */}
      <div className="w-[220px] shrink-0">
        <p className="font-display font-bold text-[13px] uppercase text-txt leading-tight">
          {team.team_name}
        </p>
        <p className="font-mono text-[10px] text-txt-3 mt-0.5 leading-tight">
          {team.car}
        </p>
      </div>

      {/* Division */}
      <p className="font-mono text-[10px] text-txt-3/60 w-[80px] shrink-0">
        {team.division_name}
      </p>

      {/* Drivers */}
      <div className="flex flex-wrap gap-4 flex-1">
        {team.members.map((m) => (
          <div key={m.driver_id} className="flex items-center gap-1.5">
            <span className="font-mono text-[12px] text-txt-2">
              {m.display_name ?? '—'}
            </span>
            {m.tier && (
              <span
                className={[
                  'font-mono text-[9px] tracking-[.1em] uppercase px-1 py-0.5',
                  m.tier === 'gold'
                    ? 'text-[#e6b53d] bg-[#e6b53d]/10'
                    : 'text-txt-3 bg-panel-2',
                ].join(' ')}
              >
                {m.tier}
              </span>
            )}
          </div>
        ))}
        {spotsOpen > 0 && (
          <span className="font-mono text-[10px] text-txt-3/40 italic self-center">
            {spotsOpen} open
          </span>
        )}
      </div>
    </div>
  );
}

function BreakdownTable({ teams }: { teams: Team[] }) {
  const counts: Record<string, Partial<Record<number, number>>> = {};
  for (const team of teams) {
    counts[team.car] = counts[team.car] ?? {};
    counts[team.car][team.division_id] =
      (counts[team.car][team.division_id] ?? 0) + 1;
  }

  const cars = [...new Set(teams.map((t) => t.car))].sort();

  if (cars.length === 0) {
    return (
      <div className="border border-line border-t-0 px-5 py-6">
        <p className="font-mono text-[12px] text-txt-3">No entries yet.</p>
      </div>
    );
  }

  return (
    <div className="border border-line border-t-0 overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-line">
            <th className="text-left px-5 py-3 font-mono text-[10px] tracking-[.25em] uppercase text-txt-3 font-normal">
              Car
            </th>
            {DIVISIONS.map((d) => (
              <th
                key={d}
                className="text-center px-4 py-3 font-mono text-[10px] tracking-[.25em] uppercase text-txt-3 font-normal"
              >
                Div {d}
              </th>
            ))}
            <th className="text-center px-4 py-3 font-mono text-[10px] tracking-[.25em] uppercase text-txt-3 font-normal">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {cars.map((car, i) => {
            const total = DIVISIONS.reduce(
              (s, d) => s + (counts[car]?.[d] ?? 0),
              0,
            );
            return (
              <tr
                key={car}
                className={[
                  'border-b border-line/30 last:border-b-0',
                  i % 2 === 1 ? 'bg-panel-2/20' : '',
                ].join(' ')}
              >
                <td className="px-5 py-2.5 font-mono text-[12px] text-txt">
                  {car}
                </td>
                {DIVISIONS.map((d) => (
                  <td
                    key={d}
                    className="text-center px-4 py-2.5 font-mono text-[12px] text-txt-2"
                  >
                    {counts[car]?.[d] ?? '—'}
                  </td>
                ))}
                <td className="text-center px-4 py-2.5 font-mono text-[12px] font-bold text-txt">
                  {total}
                </td>
              </tr>
            );
          })}
          <tr className="border-t border-line">
            <td className="px-5 py-2.5 font-mono text-[10px] tracking-[.25em] uppercase text-txt-3">
              Total
            </td>
            {DIVISIONS.map((d) => (
              <td
                key={d}
                className="text-center px-4 py-2.5 font-mono text-[12px] font-bold text-txt"
              >
                {Object.values(counts).reduce(
                  (s, dc) => s + (dc?.[d] ?? 0),
                  0,
                )}
              </td>
            ))}
            <td className="text-center px-4 py-2.5 font-mono text-[12px] font-bold text-gold">
              {teams.length}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
