'use client';

import { useState } from 'react';
import { Icon, type IconName } from '@cardog-icons/react';
import { FallbackLogoImage } from '@/components/FallbackLogoImage';

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
  // Resolved server-side (RegisterBody, via accCarManufacturerIconName /
  // accCarManufacturerLogoUrl) — same manufacturer icon/logo every other car
  // display on the site uses. At most one is non-null; both null means
  // neither exists, same as HotLapBoard's own fallback (no generic glyph).
  manufacturerIconName: string | null;
  manufacturerLogoUrl: string | null;
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
  // Highlights the signed-in viewer's own team row, same idea as HotLapBoard's
  // "My Laps" tint — undefined for a signed-out viewer, which simply never
  // matches any row.
  currentDriverId,
}: {
  teams: Team[];
  maxTeamSize: number;
  showDivisions?: boolean;
  currentDriverId?: string;
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

      {/* Filters — pill buttons + square division-badge buttons, same
          language as HotLapBoard's filter row rather than an underline tab
          strip, so this leaderboard-adjacent list reads consistently with
          every other board on the site. */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        <button
          onClick={() => setTab('all')}
          className={[
            'font-mono text-[13px] tracking-[.15em] uppercase px-3 py-1.5 border transition-colors',
            tab === 'all'
              ? 'border-gold text-gold'
              : 'border-line/50 text-txt-3 hover:text-txt hover:border-line',
          ].join(' ')}
        >
          All Teams
        </button>
        <button
          onClick={() => setTab('breakdown')}
          className={[
            'font-mono text-[13px] tracking-[.15em] uppercase px-3 py-1.5 border transition-colors',
            tab === 'breakdown'
              ? 'border-gold text-gold'
              : 'border-line/50 text-txt-3 hover:text-txt hover:border-line',
          ].join(' ')}
        >
          Breakdown
        </button>
        {showDivisions &&
          DIVISIONS.map((d) => (
            <button
              key={d}
              type="button"
              title={`Division ${d}`}
              onClick={() => setTab((cur) => (cur === d ? 'all' : d))}
              className={[
                'flex items-center justify-center w-11 h-[30px] shrink-0 px-1.5 border transition-colors cursor-pointer',
                tab === d
                  ? 'border-gold bg-gold/[.14]'
                  : 'border-line/50 bg-carbon hover:border-line hover:bg-carbon-2',
              ].join(' ')}
            >
              {/* Tierless — this is a filter control, not a driver's own
                  standing, so it uses the plain Division N badge, not a
                  gold/silver variant. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/badges/Division ${d}.png`}
                alt={`Division ${d}`}
                className="w-full h-full object-contain"
              />
            </button>
          ))}
      </div>

      {tab === 'breakdown' ? (
        <BreakdownTable teams={teams} showDivisions={showDivisions} />
      ) : visibleTeams.length === 0 ? (
        <div className="border border-line px-5 py-6">
          <p className="font-mono text-[12px] text-txt-3">No teams registered yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                <th className="font-mono text-[15px] tracking-[.3em] uppercase text-txt-3 py-2 pr-3">
                  Team
                </th>
                <th className="font-mono text-[15px] tracking-[.3em] uppercase text-txt-3 py-2 pr-3">
                  Car
                </th>
                {showDivisions && (
                  <th className="font-mono text-[15px] tracking-[.3em] uppercase text-txt-3 py-2 pr-3">
                    Division
                  </th>
                )}
                <th className="font-mono text-[15px] tracking-[.3em] uppercase text-txt-3 py-2">
                  Drivers
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleTeams.map((team) => (
                <TeamRow
                  key={team.id}
                  team={team}
                  maxTeamSize={maxTeamSize}
                  showDivisions={showDivisions}
                  isMine={team.members.some((m) => m.driver_id === currentDriverId)}
                />
              ))}
            </tbody>
          </table>
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
  showDivisions,
  isMine,
}: {
  team: Team;
  maxTeamSize: number;
  showDivisions: boolean;
  isMine: boolean;
}) {
  const spotsOpen = maxTeamSize - team.members.length;
  return (
    <tr
      className="border-b border-line/30 last:border-b-0"
      style={isMine ? { backgroundColor: 'color-mix(in srgb, var(--sim-accent) 12%, transparent)' } : undefined}
    >
      <td className="py-2.5 pr-3 align-middle">
        <p className="font-display font-bold text-[15px] uppercase text-txt leading-tight">
          {team.team_name}
        </p>
      </td>

      <td className="py-2.5 pr-3 align-middle">
        <span className="flex items-center gap-2 font-sans text-[13px] text-txt-3">
          {team.manufacturerIconName ? (
            <span className="relative w-4 h-4 shrink-0 flex items-center justify-center">
              <Icon name={team.manufacturerIconName as IconName} size={16} />
            </span>
          ) : (
            team.manufacturerLogoUrl && (
              <span className="relative w-4 h-4 shrink-0">
                <FallbackLogoImage src={team.manufacturerLogoUrl} alt={team.car} sizes="16px" />
              </span>
            )
          )}
          {team.car}
        </span>
      </td>

      {/* Division — omitted entirely on an ungraded championship rather than
          rendering an empty column. */}
      {showDivisions && (
        <td className="py-2.5 pr-3 align-middle font-mono text-[13px] text-txt-3/75">
          {team.division_name ?? '—'}
        </td>
      )}

      <td className="py-2.5 align-middle">
        <div className="flex flex-wrap gap-4">
          {team.members.map((m) => (
            <div key={m.driver_id} className="flex items-center gap-2">
              {/* Badge art is per-division ("Division 3 Gold.png"), so there
                  is no badge to show for an ungraded entry — division_id
                  NULL would request /badges/Division null Gold.png. */}
              {m.tier && team.division_id != null && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/badges/Division ${team.division_id} ${m.tier === 'gold' ? 'Gold' : 'Silver'}.png`}
                  alt={`Div ${team.division_id} ${m.tier}`}
                  className="h-6 w-auto"
                />
              )}
              <span className="font-display font-bold text-[13px] uppercase text-txt">
                {m.display_name ?? '—'}
              </span>
            </div>
          ))}
          {spotsOpen > 0 && (
            <span className="font-mono text-[10px] text-txt-3/40 italic self-center">
              {spotsOpen} open
            </span>
          )}
        </div>
      </td>
    </tr>
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
