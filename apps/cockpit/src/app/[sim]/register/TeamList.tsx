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
  // Raw id behind `car` above — kept alongside the display string so the
  // edit-registration form (CurrentTeam) can pre-select the right <option>
  // via allowedCarNameForModelId(), which accCarModelName()'s display string
  // can't do (see that helper's comment). Not used for display.
  carModelId: number | null;
  // NULL on a championship that doesn't grade its entries — see
  // championships.requires_division.
  division_id: number | null;
  division_name: string | null;
  members: Member[];
};

type Tab = 'all' | 1 | 2 | 3 | 4 | 'breakdown';

const DIVISIONS = [1, 2, 3, 4] as const;

export default function TeamList({
  teams,
  maxTeamSize,
  // Drives whether the division tiles, tabs and per-row badges appear at all.
  // On a single-grid event they'd be four empty tiles and four empty tabs.
  showDivisions = true,
}: {
  teams: Team[];
  maxTeamSize: number;
  showDivisions?: boolean;
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
        {showDivisions &&
          divStats.map((ds) => (
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
        {((showDivisions
          ? ['all', 1, 2, 3, 4, 'breakdown']
          : ['all', 'breakdown']) as Tab[]).map((t) => (
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
        <BreakdownTable teams={teams} showDivisions={showDivisions} />
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

      {/* Division — omitted entirely on an ungraded championship rather than
          left as an empty 80px gutter. */}
      {team.division_name && (
        <p className="font-mono text-[10px] text-txt-3/60 w-[80px] shrink-0">
          {team.division_name}
        </p>
      )}

      {/* Drivers */}
      <div className="flex flex-wrap gap-4 flex-1">
        {team.members.map((m) => (
          <div key={m.driver_id} className="flex items-center gap-2">
            <span className="font-mono text-[12px] text-txt-2">
              {m.display_name ?? '—'}
            </span>
            {/* Badge art is per-division ("Division 3 Gold.png"), so there is
                no badge to show for an ungraded entry — division_id NULL would
                request /badges/Division null Gold.png. */}
            {m.tier && team.division_id != null && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/badges/Division ${team.division_id} ${m.tier === 'gold' ? 'Gold' : 'Silver'}.png`}
                alt={`Div ${team.division_id} ${m.tier}`}
                className="h-5 w-auto"
              />
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

function BreakdownTable({
  teams,
  showDivisions,
}: {
  teams: Team[];
  showDivisions: boolean;
}) {
  // Keyed by division on a graded championship. Ungraded entries have a NULL
  // division_id, which would land in a column no header renders and total to
  // zero — so those get the car-only table below instead.
  const counts: Record<string, Partial<Record<number, number>>> = {};
  for (const team of teams) {
    if (team.division_id == null) continue;
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

  // Single-grid championship: car counts are the whole breakdown.
  if (!showDivisions) {
    const carCounts = cars
      .map((car) => ({ car, n: teams.filter((t) => t.car === car).length }))
      .sort((a, b) => b.n - a.n || a.car.localeCompare(b.car));

    return (
      <div className="border border-line border-t-0 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line">
              <th className="text-left px-5 py-3 font-mono text-[10px] tracking-[.25em] uppercase text-txt-3 font-normal">
                Car
              </th>
              <th className="text-center px-4 py-3 font-mono text-[10px] tracking-[.25em] uppercase text-txt-3 font-normal">
                Entries
              </th>
            </tr>
          </thead>
          <tbody>
            {carCounts.map(({ car, n }, i) => (
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
                <td className="text-center px-4 py-2.5 font-mono text-[12px] font-bold text-txt">
                  {n}
                </td>
              </tr>
            ))}
            <tr className="border-t border-line">
              <td className="px-5 py-2.5 font-mono text-[10px] tracking-[.25em] uppercase text-txt-3">
                Total
              </td>
              <td className="text-center px-4 py-2.5 font-mono text-[12px] font-bold text-gold">
                {teams.length}
              </td>
            </tr>
          </tbody>
        </table>
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
