'use client';

import { DivisionBadge } from '@/components/DivisionBadge';
import { useState } from 'react';
import { CarLogo } from '@/components/CarLogo';
import { DriverTierBadge } from '@/components/DriverTierBadge';

export type Member = {
  driver_id: string;
  display_name: string | null;
  tier: 'gold' | 'silver' | null;
  is_sralien: boolean;
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
              label={<DivisionBadge division={ds.div} height={22} />}
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
              <DivisionBadge division={d} height={22} />
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
  // ReactNode, not string: the per-division boxes label themselves with the
  // division badge rather than the words "Division N".
  label: React.ReactNode;
  value: string;
  sub?: string;
}) {
  return (
    <div className="border border-line bg-panel px-4 py-3">
      <div className="font-mono text-[9px] tracking-[.3em] uppercase text-txt-3 mb-1 min-h-[22px] flex items-center">
        {label}
      </div>
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
        <CarLabel
          car={team.car}
          manufacturerIconName={team.manufacturerIconName}
          manufacturerLogoUrl={team.manufacturerLogoUrl}
          className="font-sans text-[14px] text-txt-3"
          iconSize={26}
        />
      </td>

      {/* Division — omitted entirely on an ungraded championship rather than
          rendering an empty column. */}
      {showDivisions && (
        <td className="py-2.5 pr-3 align-middle font-mono text-[13px] text-txt-3/75">
          {team.division_id != null ? (
            <DivisionBadge
              division={team.division_id}
              label={team.division_name ?? undefined}
              height={24}
            />
          ) : (
            '—'
          )}
        </td>
      )}

      <td className="py-2.5 align-middle">
        {/* Stacked, one driver per line — a car-per-driver team reads as a
            roster, not a row of names. */}
        <div className="flex flex-col gap-1.5">
          {team.members.map((m) => (
            <div key={m.driver_id} className="flex items-center gap-2">
              <DriverTierBadge isSralien={m.is_sralien} division={team.division_id} tier={m.tier} />
              <span className="font-display font-bold text-[16px] uppercase text-txt">
                {m.display_name ?? '—'}
              </span>
            </div>
          ))}
          {spotsOpen > 0 && (
            <span className="font-mono text-[10px] text-txt-3/40 italic">
              {spotsOpen} open
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

// Manufacturer icon/logo + car name, shared by the entry rows and the car
// breakdown so a car looks the same in both. Icon where @cardog-icons has
// one, else our uploaded SVG logo, else just the name (no generic glyph).
function CarLabel({
  car,
  manufacturerIconName,
  manufacturerLogoUrl,
  className,
  iconSize = 16,
}: {
  car: string;
  manufacturerIconName: string | null;
  manufacturerLogoUrl: string | null;
  className: string;
  iconSize?: number;
}) {
  return (
    <span className={`flex items-center gap-3 ${className}`}>
      <CarLogo
        manufacturerIconName={manufacturerIconName}
        manufacturerLogoUrl={manufacturerLogoUrl}
        alt={car}
        size={iconSize}
      />
      {car}
    </span>
  );
}

// Sort state for the breakdown: a division number, the grand total, or the
// car name. Total-descending is the default because "which car is most
// popular" is the question this table exists to answer — alphabetical put the
// answer nowhere in particular.
type BreakdownSort = { key: 'car' | 'total' | number; dir: 'asc' | 'desc' };

function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
  align = 'center',
}: {
  label: React.ReactNode;
  sortKey: BreakdownSort['key'];
  sort: BreakdownSort;
  onSort: (key: BreakdownSort['key']) => void;
  align?: 'left' | 'center';
}) {
  const active = sort.key === sortKey;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={[
        align === 'left' ? 'text-left px-5' : 'text-center px-4',
        'py-3 font-mono text-[10px] tracking-[.25em] uppercase font-normal',
        active ? 'text-txt' : 'text-txt-3',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={[
          'inline-flex items-center gap-1.5 uppercase tracking-[.25em] hover:text-gold-soft transition-colors',
          align === 'left' ? '' : 'mx-auto',
        ].join(' ')}
      >
        {label}
        {/* Caret only reads as gold on the active column. A neutral one still
            shows on the rest so the whole row looks sortable — a header that
            gives no hint until you click it is a feature nobody finds. */}
        <span aria-hidden="true" className={active ? 'text-gold' : 'text-txt-3/30'}>
          {active ? (sort.dir === 'asc' ? '▲' : '▼') : '▾'}
        </span>
      </button>
    </th>
  );
}

function BreakdownTable({
  teams,
  showDivisions,
}: {
  teams: Team[];
  showDivisions: boolean;
}) {
  const [sort, setSort] = useState<BreakdownSort>({ key: 'total', dir: 'desc' });

  // Clicking a new column starts from the most useful direction for it:
  // biggest-first for a count, A–Z for the car name. Clicking the active
  // column flips it.
  const onSort = (key: BreakdownSort['key']) =>
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'car' ? 'asc' : 'desc' },
    );

  // COUNTS ARE CARS, NOT TEAMS. A team fields one car per driver, so a full
  // two-driver team is two cars on the grid — but a team that hasn't found a
  // teammate yet is one. Multiplying teams by max_team_size would invent a car
  // for every unfilled seat (at time of writing, 17 of 95 teams are
  // half-empty), so this counts members instead. That also stays correct on a
  // solo championship, where members.length is 1 and cars equals teams.
  const counts: Record<string, Partial<Record<number, number>>> = {};
  for (const team of teams) {
    if (team.division_id == null) continue;
    counts[team.car] = counts[team.car] ?? {};
    counts[team.car][team.division_id] =
      (counts[team.car][team.division_id] ?? 0) + team.members.length;
  }

  // Logo per car name — every team on the same car resolved the same
  // icon/logo server-side, so the first one seen is as good as any.
  const logoFor = new Map<string, Pick<Team, 'manufacturerIconName' | 'manufacturerLogoUrl'>>();
  for (const t of teams) {
    if (!logoFor.has(t.car)) {
      logoFor.set(t.car, {
        manufacturerIconName: t.manufacturerIconName,
        manufacturerLogoUrl: t.manufacturerLogoUrl,
      });
    }
  }
  const carCell = (car: string) => (
    <CarLabel
      car={car}
      manufacturerIconName={logoFor.get(car)?.manufacturerIconName ?? null}
      manufacturerLogoUrl={logoFor.get(car)?.manufacturerLogoUrl ?? null}
      className="font-mono text-[12px] text-txt"
      iconSize={20}
    />
  );

  const emptyState = (
    <div className="border border-line border-t-0 px-5 py-6">
      <p className="font-mono text-[12px] text-txt-3">No entries yet.</p>
    </div>
  );

  if (teams.length === 0) return emptyState;

  // Single-grid championship: car counts are the whole breakdown.
  if (!showDivisions) {
    const rows = [...new Set(teams.map((t) => t.car))].map((car) => ({
      car,
      total: teams
        .filter((t) => t.car === car)
        .reduce((s, t) => s + t.members.length, 0),
    }));
    // Only 'car' and 'total' exist here, so a division key left over from the
    // graded table falls through to the total comparison.
    const sorted = [...rows].sort((a, b) => {
      const d =
        sort.key === 'car'
          ? a.car.localeCompare(b.car)
          : a.total - b.total || a.car.localeCompare(b.car);
      return sort.dir === 'asc' ? d : -d;
    });
    const grand = rows.reduce((s, r) => s + r.total, 0);

    return (
      <div className="border border-line border-t-0 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line">
              <SortableHeader label="Car" sortKey="car" sort={sort} onSort={onSort} align="left" />
              <SortableHeader label="Cars" sortKey="total" sort={sort} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ car, total }, i) => (
              <tr
                key={car}
                className={[
                  'border-b border-line/30 last:border-b-0',
                  i % 2 === 1 ? 'bg-panel-2/20' : '',
                ].join(' ')}
              >
                <td className="px-5 py-2.5">{carCell(car)}</td>
                <td className="text-center px-4 py-2.5 font-mono text-[12px] font-bold text-txt">
                  {total}
                </td>
              </tr>
            ))}
            <tr className="border-t border-line">
              <td className="px-5 py-2.5 font-mono text-[10px] tracking-[.25em] uppercase text-txt-3">
                Total
              </td>
              <td className="text-center px-4 py-2.5 font-mono text-[12px] font-bold text-gold">
                {grand}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  // Rows come from `counts`, not from every car seen: an ungraded entry (NULL
  // division_id) contributes to no column, so building rows from all cars
  // would render a line of nothing but dashes.
  const rows = Object.keys(counts).map((car) => ({
    car,
    perDiv: counts[car] ?? {},
    total: DIVISIONS.reduce((s, d) => s + (counts[car]?.[d] ?? 0), 0),
  }));

  if (rows.length === 0) return emptyState;

  const sorted = [...rows].sort((a, b) => {
    let d: number;
    if (sort.key === 'car') {
      d = a.car.localeCompare(b.car);
    } else if (sort.key === 'total') {
      d = a.total - b.total || a.car.localeCompare(b.car);
    } else {
      // Within a division, ties fall back to the overall total and then the
      // name, so the order stays stable instead of following key order.
      const an = a.perDiv[sort.key as number] ?? 0;
      const bn = b.perDiv[sort.key as number] ?? 0;
      d = an - bn || a.total - b.total || a.car.localeCompare(b.car);
    }
    return sort.dir === 'asc' ? d : -d;
  });

  const divTotal = (d: number) => rows.reduce((s, r) => s + (r.perDiv[d] ?? 0), 0);
  // Sum of the rows, not teams.length — the footer has to agree with the
  // column above it, and ungraded entries never made it into one.
  const grand = rows.reduce((s, r) => s + r.total, 0);

  return (
    <div className="border border-line border-t-0 overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-line">
            <SortableHeader label="Car" sortKey="car" sort={sort} onSort={onSort} align="left" />
            {DIVISIONS.map((d) => (
              <SortableHeader key={d} label={`Div ${d}`} sortKey={d} sort={sort} onSort={onSort} />
            ))}
            <SortableHeader label="Total" sortKey="total" sort={sort} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ car, perDiv, total }, i) => (
            <tr
              key={car}
              className={[
                'border-b border-line/30 last:border-b-0',
                i % 2 === 1 ? 'bg-panel-2/20' : '',
              ].join(' ')}
            >
              <td className="px-5 py-2.5">{carCell(car)}</td>
              {DIVISIONS.map((d) => (
                <td
                  key={d}
                  className={[
                    'text-center px-4 py-2.5 font-mono text-[12px]',
                    // The sorted column reads brighter, so it's obvious which
                    // one the order is following.
                    sort.key === d ? 'text-txt' : 'text-txt-2',
                  ].join(' ')}
                >
                  {perDiv[d] ?? '—'}
                </td>
              ))}
              <td className="text-center px-4 py-2.5 font-mono text-[12px] font-bold text-txt">
                {total}
              </td>
            </tr>
          ))}
          <tr className="border-t border-line">
            <td className="px-5 py-2.5 font-mono text-[10px] tracking-[.25em] uppercase text-txt-3">
              Total
            </td>
            {DIVISIONS.map((d) => (
              <td
                key={d}
                className="text-center px-4 py-2.5 font-mono text-[12px] font-bold text-txt"
              >
                {divTotal(d)}
              </td>
            ))}
            <td className="text-center px-4 py-2.5 font-mono text-[12px] font-bold text-gold">
              {grand}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
