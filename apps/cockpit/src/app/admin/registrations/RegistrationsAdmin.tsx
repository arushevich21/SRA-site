'use client';

import { useState, useTransition } from 'react';
import { deleteTeam, removeMember, setEntryClass } from './actions';

export type AdminMember = {
  driver_id: string;
  display_name: string | null;
  steam_id: string | null;
  discord_id: string | null;
  tier: 'gold' | 'silver' | null;
  divisionName: string | null; // Team Series division, shown for reference
};

export type AdminTeam = {
  id: string;
  team_name: string;
  car: string;
  division_id: number | null;
  division_name: string | null;
  entryClass: string | null;
  members: AdminMember[];
};

export type AdminChampionship = {
  key: string;
  season: string;
  title: string;
  maxTeamSize: number;
  registrationOpen: boolean;
  grouping: 'division' | 'class';
  teams: AdminTeam[];
};

const DIVISION_GROUPS = [
  { key: '1', label: 'Division 1' },
  { key: '2', label: 'Division 2' },
  { key: '3', label: 'Division 3' },
  { key: '4', label: 'Division 4' },
];
const ENDURANCE_CLASSES = ['Open', 'Silver', 'Bronze'];
const CLASS_GROUPS = ENDURANCE_CLASSES.map((c) => ({ key: c, label: c }));

function groupsFor(champ: AdminChampionship) {
  return champ.grouping === 'class' ? CLASS_GROUPS : DIVISION_GROUPS;
}
function teamGroupKey(champ: AdminChampionship, team: AdminTeam): string | null {
  if (champ.grouping === 'class') return team.entryClass;
  return team.division_id != null ? String(team.division_id) : null;
}

export default function RegistrationsAdmin({
  championships,
}: {
  championships: AdminChampionship[];
}) {
  const [champKey, setChampKey] = useState(championships[0]?.key ?? '');
  const [tab, setTab] = useState<string>('all');
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const champ = championships.find((c) => c.key === champKey) ?? championships[0];
  if (!champ) return null;

  const groups = groupsFor(champ);
  const hasUnassigned = champ.teams.some((t) => teamGroupKey(champ, t) == null);

  const teams =
    tab === 'all'
      ? champ.teams
      : tab === 'unassigned'
        ? champ.teams.filter((t) => teamGroupKey(champ, t) == null)
        : champ.teams.filter((t) => teamGroupKey(champ, t) === tab);

  const totalMembers = champ.teams.reduce((s, t) => s + t.members.length, 0);
  const totalSlots = champ.teams.length * champ.maxTeamSize;

  function run(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Action failed');
      } finally {
        setBusyId(null);
      }
    });
  }

  function onDeleteTeam(team: AdminTeam) {
    if (
      !confirm(
        `Delete team "${team.team_name}"? This frees ${team.members.length} driver(s) to register again. This cannot be undone.`,
      )
    )
      return;
    run(team.id, () => deleteTeam(team.id));
  }

  function onRemoveMember(team: AdminTeam, m: AdminMember) {
    if (
      !confirm(
        `Remove ${m.display_name ?? 'this driver'} from "${team.team_name}"? The team stays under-filled and the driver can register again.`,
      )
    )
      return;
    run(`${team.id}:${m.driver_id}`, () => removeMember(team.id, m.driver_id));
  }

  function onSetClass(team: AdminTeam, value: string) {
    run(`class:${team.id}`, () => setEntryClass(team.id, value || null));
  }

  function exportCsv() {
    const header = [
      'team_name', 'car', 'division', 'class',
      'driver_name', 'driver_division', 'steam_id', 'discord_id', 'tier',
    ];
    const rows: string[][] = [];
    for (const t of champ.teams) {
      const base = [t.team_name, t.car, t.division_name ?? '', t.entryClass ?? ''];
      if (t.members.length === 0) {
        rows.push([...base, '', '', '', '', '']);
        continue;
      }
      for (const m of t.members) {
        rows.push([
          ...base,
          m.display_name ?? '', m.divisionName ?? '', m.steam_id ?? '', m.discord_id ?? '', m.tier ?? '',
        ]);
      }
    }
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${champ.key}-${champ.season}-registrations.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={pending ? 'opacity-60 pointer-events-none' : ''}>
      {championships.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {championships.map((c) => (
            <button
              key={c.key}
              onClick={() => { setChampKey(c.key); setTab('all'); }}
              className={[
                'font-mono text-[11px] tracking-[.15em] uppercase px-4 py-2 border transition-colors',
                c.key === champ.key
                  ? 'border-gold text-gold bg-gold/5'
                  : 'border-line text-txt-3 hover:text-txt',
              ].join(' ')}
            >
              {c.title}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <span
          className={[
            'font-mono text-[10px] tracking-[.25em] uppercase px-3 py-1 border',
            champ.registrationOpen ? 'text-live border-live/40' : 'text-txt-3 border-line',
          ].join(' ')}
        >
          {champ.registrationOpen ? 'Registration Open' : 'Registration Closed'}
        </span>
        <button
          onClick={exportCsv}
          disabled={champ.teams.length === 0}
          className="font-mono text-[11px] tracking-[.15em] uppercase px-4 py-2 border border-line text-txt-2 hover:border-gold/50 hover:text-gold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Export CSV ↓
        </button>
      </div>

      {/* Stats — buckets follow the championship's grouping */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <StatBox label="Total Teams" value={String(champ.teams.length)} />
        <StatBox
          label="Drivers"
          value={totalSlots > 0 ? `${totalMembers} / ${totalSlots}` : String(totalMembers)}
          sub={totalSlots > 0 ? `${Math.round((totalMembers / totalSlots) * 100)}% filled` : undefined}
        />
        {groups.map((g) => {
          const gt = champ.teams.filter((t) => teamGroupKey(champ, t) === g.key);
          return (
            <StatBox
              key={g.key}
              label={g.label}
              value={`${gt.length} teams`}
              sub={`${gt.reduce((s, t) => s + t.members.length, 0)} drivers`}
            />
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-line overflow-x-auto">
        {(['all', ...groups.map((g) => g.key), ...(hasUnassigned ? ['unassigned'] : [])]).map((t) => {
          const label =
            t === 'all' ? 'All Teams'
              : t === 'unassigned' ? 'Unassigned'
                : groups.find((g) => g.key === t)?.label ?? t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                'font-mono text-[10px] tracking-[.2em] uppercase px-5 py-3 border-r border-line whitespace-nowrap transition-colors shrink-0',
                tab === t ? 'bg-panel-2 text-txt' : 'text-txt-3 hover:text-txt',
              ].join(' ')}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="border border-line border-t-0">
        {teams.length === 0 ? (
          <p className="font-mono text-[12px] text-txt-3 px-5 py-6">No teams here yet.</p>
        ) : (
          teams.map((team, i) => (
            <TeamRow
              key={team.id}
              champ={champ}
              team={team}
              stripe={i % 2 === 1}
              busyId={busyId}
              onDeleteTeam={onDeleteTeam}
              onRemoveMember={onRemoveMember}
              onSetClass={onSetClass}
            />
          ))
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-line bg-panel px-4 py-3">
      <p className="font-mono text-[9px] tracking-[.3em] uppercase text-txt-3 mb-1">{label}</p>
      <p className="font-mono text-[17px] font-bold text-txt leading-tight">{value}</p>
      {sub && <p className="font-mono text-[10px] text-txt-3 mt-0.5">{sub}</p>}
    </div>
  );
}

function TeamRow({
  champ, team, stripe, busyId, onDeleteTeam, onRemoveMember, onSetClass,
}: {
  champ: AdminChampionship;
  team: AdminTeam;
  stripe: boolean;
  busyId: string | null;
  onDeleteTeam: (t: AdminTeam) => void;
  onRemoveMember: (t: AdminTeam, m: AdminMember) => void;
  onSetClass: (t: AdminTeam, value: string) => void;
}) {
  const spotsOpen = champ.maxTeamSize - team.members.length;
  const isClass = champ.grouping === 'class';

  return (
    <div
      className={[
        'flex items-start gap-4 px-5 py-3 border-b border-line/30 last:border-b-0 flex-wrap',
        stripe ? 'bg-panel-2/20' : '',
      ].join(' ')}
    >
      <div className="w-[200px] shrink-0">
        <p className="font-display font-bold text-[13px] uppercase text-txt leading-tight">
          {team.team_name}
        </p>
        <p className="font-mono text-[10px] text-txt-3 mt-0.5 leading-tight">{team.car}</p>
        {isClass ? (
          <select
            value={team.entryClass ?? ''}
            onChange={(e) => onSetClass(team, e.target.value)}
            disabled={busyId === `class:${team.id}`}
            className="mt-1.5 bg-carbon-2 border border-line text-txt font-mono text-[11px] px-2 py-1 focus:border-gold focus:outline-none disabled:opacity-50"
          >
            <option value="">— Unassigned —</option>
            {ENDURANCE_CLASSES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        ) : (
          <p className="font-mono text-[10px] text-txt-3/60 mt-0.5">
            {team.division_name ?? '—'}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 flex-1 min-w-[260px]">
        {team.members.map((m) => {
          const memberBusy = busyId === `${team.id}:${m.driver_id}`;
          return (
            <div key={m.driver_id} className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-[12px] text-txt-2 min-w-[140px]">
                {m.display_name ?? '—'}
                {m.tier && <span className="text-txt-3/50"> · {m.tier}</span>}
              </span>
              {isClass && (
                <span className="font-mono text-[10px] text-txt-3/70">
                  {m.divisionName ?? 'No division'}
                </span>
              )}
              <span className="font-mono text-[10px] text-txt-3/70">
                Steam: <span className="text-txt-3">{m.steam_id ?? '—'}</span>
              </span>
              <span className="font-mono text-[10px] text-txt-3/70">
                Discord: <span className="text-txt-3">{m.discord_id ?? '—'}</span>
              </span>
              <button
                onClick={() => onRemoveMember(team, m)}
                disabled={memberBusy}
                className="font-mono text-[10px] tracking-[.1em] uppercase text-txt-3/60 hover:text-red-400 transition-colors disabled:opacity-40"
              >
                {memberBusy ? '…' : 'Remove'}
              </button>
            </div>
          );
        })}
        {spotsOpen > 0 && (
          <span className="font-mono text-[10px] text-txt-3/40 italic">
            {spotsOpen} spot{spotsOpen === 1 ? '' : 's'} open
          </span>
        )}
      </div>

      <div className="shrink-0 self-center">
        <button
          onClick={() => onDeleteTeam(team)}
          disabled={busyId === team.id}
          className="font-mono text-[10px] tracking-[.1em] uppercase px-3 py-1.5 border border-line text-txt-3 hover:border-red-500/50 hover:text-red-400 transition-colors disabled:opacity-40"
        >
          {busyId === team.id ? 'Deleting…' : 'Delete Team'}
        </button>
      </div>
    </div>
  );
}
