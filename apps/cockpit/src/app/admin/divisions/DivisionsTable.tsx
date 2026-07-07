'use client';

import { useState, useTransition, useMemo } from 'react';
import { assignDivision, assignTier, assignBulk } from './actions';

export type DriverRow = {
  id: string;
  display_name: string | null;
  discord_id: string | null;
  steam_id: string | null;
  division_id: number | null;
  tier: 'gold' | 'silver' | null;
};

export type Division = {
  id: number;
  name: string;
};

type DivFilter = number | 'none' | null;
type TierFilter = 'gold' | 'silver' | 'none' | null;

const SELECT_CLS =
  'bg-transparent border border-line px-2 py-1 font-mono text-[11px] text-txt focus:outline-none focus:border-gold cursor-pointer';

const FILTER_CLS =
  'bg-panel-2 border border-line px-3 py-2 font-mono text-[12px] text-txt focus:outline-none focus:border-gold cursor-pointer';

export default function DivisionsTable({
  initialDrivers,
  divisions,
}: {
  initialDrivers: DriverRow[];
  divisions: Division[];
}) {
  const [drivers, setDrivers] = useState(initialDrivers);
  const [search, setSearch] = useState('');
  const [divFilter, setDivFilter] = useState<DivFilter>(null);
  const [tierFilter, setTierFilter] = useState<TierFilter>(null);
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDivision, setBulkDivision] = useState('');
  const [bulkTier, setBulkTier] = useState('');
  const [isPending, startTransition] = useTransition();

  const unassignedCount = useMemo(
    () => drivers.filter((d) => d.division_id === null || d.tier === null).length,
    [drivers],
  );

  const filtered = useMemo(() => {
    return drivers.filter((d) => {
      if (search) {
        const q = search.toLowerCase();
        const nameMatch = d.display_name?.toLowerCase().includes(q);
        const discordMatch = d.discord_id?.includes(q);
        const steamMatch = d.steam_id?.includes(q);
        if (!nameMatch && !discordMatch && !steamMatch) return false;
      }
      if (onlyUnassigned) {
        return d.division_id === null || d.tier === null;
      }
      if (divFilter === 'none') {
        if (d.division_id !== null) return false;
      } else if (divFilter !== null) {
        if (d.division_id !== divFilter) return false;
      }
      if (tierFilter === 'none') {
        if (d.tier !== null) return false;
      } else if (tierFilter !== null) {
        if (d.tier !== tierFilter) return false;
      }
      return true;
    });
  }, [drivers, search, divFilter, tierFilter, onlyUnassigned]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((d) => selected.has(d.id));

  function toggleRow(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((d) => next.delete(d.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((d) => next.add(d.id));
        return next;
      });
    }
  }

  function patchDrivers(ids: string[], patch: Partial<DriverRow>) {
    setDrivers((prev) =>
      prev.map((d) => (ids.includes(d.id) ? { ...d, ...patch } : d)),
    );
  }

  function handleDivisionChange(driverId: string, raw: string) {
    const newDiv = raw === '' ? null : parseInt(raw);
    patchDrivers([driverId], { division_id: newDiv });
    startTransition(async () => {
      await assignDivision([driverId], newDiv);
    });
  }

  function handleTierChange(driverId: string, raw: string) {
    const newTier = raw === '' ? null : (raw as 'gold' | 'silver');
    patchDrivers([driverId], { tier: newTier });
    startTransition(async () => {
      await assignTier([driverId], newTier);
    });
  }

  function handleBulkAssign() {
    const ids = Array.from(selected);
    const newDiv =
      bulkDivision === ''
        ? undefined
        : bulkDivision === 'null'
          ? null
          : parseInt(bulkDivision);
    const newTier =
      bulkTier === ''
        ? undefined
        : bulkTier === 'null'
          ? null
          : (bulkTier as 'gold' | 'silver');

    const patch: Partial<DriverRow> = {};
    if (newDiv !== undefined) patch.division_id = newDiv;
    if (newTier !== undefined) patch.tier = newTier;
    patchDrivers(ids, patch);
    setSelected(new Set());
    setBulkDivision('');
    setBulkTier('');

    startTransition(async () => {
      await assignBulk(ids, newDiv, newTier);
    });
  }

  function clearFilters() {
    setSearch('');
    setDivFilter(null);
    setTierFilter(null);
    setOnlyUnassigned(false);
  }

  const hasActiveFilter =
    search || divFilter !== null || tierFilter !== null || onlyUnassigned;

  const visibleDrivers = filtered.slice(0, 200);

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search name / Discord ID / Steam ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-panel-2 border border-line px-3 py-2 font-mono text-[12px] text-txt placeholder:text-txt-3 focus:outline-none focus:border-gold w-[300px]"
        />

        <select
          value={
            divFilter === null
              ? ''
              : divFilter === 'none'
                ? 'none'
                : String(divFilter)
          }
          onChange={(e) => {
            setOnlyUnassigned(false);
            setDivFilter(
              e.target.value === ''
                ? null
                : e.target.value === 'none'
                  ? 'none'
                  : parseInt(e.target.value),
            );
          }}
          className={FILTER_CLS}
        >
          <option value="">All Divisions</option>
          {divisions.map((div) => (
            <option key={div.id} value={String(div.id)}>
              {div.name}
            </option>
          ))}
          <option value="none">No Division</option>
        </select>

        <select
          value={tierFilter ?? ''}
          onChange={(e) => {
            setOnlyUnassigned(false);
            setTierFilter(
              e.target.value === '' ? null : (e.target.value as TierFilter),
            );
          }}
          className={FILTER_CLS}
        >
          <option value="">All Tiers</option>
          <option value="gold">Gold</option>
          <option value="silver">Silver</option>
          <option value="none">No Tier</option>
        </select>

        <button
          onClick={() => {
            setOnlyUnassigned((v) => !v);
            setDivFilter(null);
            setTierFilter(null);
          }}
          className={[
            'px-3 py-2 border font-mono text-[11px] tracking-[.15em] uppercase transition-colors',
            onlyUnassigned
              ? 'border-gold bg-gold/10 text-gold'
              : 'border-line text-txt-3 hover:text-txt hover:border-txt-3',
          ].join(' ')}
        >
          Unassigned ({unassignedCount})
        </button>

        {hasActiveFilter && (
          <button
            onClick={clearFilters}
            className="font-mono text-[11px] tracking-[.15em] uppercase text-txt-3 hover:text-txt transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4 px-4 py-3 border border-gold/20 bg-gold/5">
          <span className="font-mono text-[11px] tracking-[.15em] uppercase text-gold shrink-0">
            {selected.size} selected
          </span>
          <select
            value={bulkDivision}
            onChange={(e) => setBulkDivision(e.target.value)}
            className="bg-carbon border border-line px-2 py-1.5 font-mono text-[11px] text-txt focus:outline-none focus:border-gold"
          >
            <option value="">Set division…</option>
            {divisions.map((div) => (
              <option key={div.id} value={String(div.id)}>
                {div.name}
              </option>
            ))}
            <option value="null">Remove division</option>
          </select>
          <select
            value={bulkTier}
            onChange={(e) => setBulkTier(e.target.value)}
            className="bg-carbon border border-line px-2 py-1.5 font-mono text-[11px] text-txt focus:outline-none focus:border-gold"
          >
            <option value="">Set tier…</option>
            <option value="gold">Gold</option>
            <option value="silver">Silver</option>
            <option value="null">Remove tier</option>
          </select>
          <button
            onClick={handleBulkAssign}
            disabled={isPending || (bulkDivision === '' && bulkTier === '')}
            className="px-4 py-1.5 bg-gold text-carbon font-mono text-[11px] tracking-[.15em] uppercase font-bold hover:bg-gold-soft transition-colors disabled:opacity-40"
          >
            Apply
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="font-mono text-[11px] tracking-[.15em] uppercase text-txt-3 hover:text-txt transition-colors"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Count + save indicator */}
      <p className="font-mono text-[10px] tracking-[.25em] uppercase text-txt-3 mb-3">
        {filtered.length === drivers.length
          ? `${drivers.length} drivers`
          : `${filtered.length} of ${drivers.length} drivers`}
        {filtered.length > 200 && ' · showing first 200 — search to narrow'}
        {isPending && (
          <span className="text-gold"> · saving…</span>
        )}
      </p>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-line">
              <th className="pb-3 pr-4 w-8">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAll}
                  className="cursor-pointer"
                  title="Select all visible"
                />
              </th>
              <th className="pb-3 pr-6 text-left font-mono text-[10px] tracking-[.25em] uppercase text-txt-3">
                Name
              </th>
              <th className="pb-3 pr-6 text-left font-mono text-[10px] tracking-[.25em] uppercase text-txt-3">
                Discord ID
              </th>
              <th className="pb-3 pr-6 text-left font-mono text-[10px] tracking-[.25em] uppercase text-txt-3">
                Division
              </th>
              <th className="pb-3 text-left font-mono text-[10px] tracking-[.25em] uppercase text-txt-3">
                Tier
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleDrivers.map((driver) => {
              const isSelected = selected.has(driver.id);
              const missingDiv = driver.division_id === null;
              const missingTier = driver.tier === null;

              return (
                <tr
                  key={driver.id}
                  className={[
                    'border-b border-line/30 transition-colors',
                    isSelected ? 'bg-gold/5' : 'hover:bg-panel-2/40',
                  ].join(' ')}
                >
                  <td className="py-2.5 pr-4">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => toggleRow(driver.id, e.target.checked)}
                      className="cursor-pointer"
                    />
                  </td>
                  <td className="py-2.5 pr-6">
                    <span className="font-mono text-[12px] text-txt">
                      {driver.display_name ?? '—'}
                    </span>
                  </td>
                  <td className="py-2.5 pr-6">
                    <span className="font-mono text-[11px] text-txt-3">
                      {driver.discord_id ?? '—'}
                    </span>
                  </td>
                  <td className="py-2.5 pr-6">
                    <select
                      value={driver.division_id !== null ? String(driver.division_id) : ''}
                      onChange={(e) => handleDivisionChange(driver.id, e.target.value)}
                      className={[
                        SELECT_CLS,
                        missingDiv ? 'border-gold-deep/50 text-gold-deep' : '',
                      ].join(' ')}
                    >
                      <option value="">—</option>
                      {divisions.map((div) => (
                        <option key={div.id} value={String(div.id)}>
                          {div.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2.5">
                    <select
                      value={driver.tier ?? ''}
                      onChange={(e) => handleTierChange(driver.id, e.target.value)}
                      className={[
                        SELECT_CLS,
                        missingTier ? 'border-gold-deep/50 text-gold-deep' : '',
                        driver.tier === 'gold' ? 'text-[#e6b53d]' : '',
                      ].join(' ')}
                    >
                      <option value="">—</option>
                      <option value="gold">Gold</option>
                      <option value="silver">Silver</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {visibleDrivers.length === 0 && (
          <p className="font-mono text-[12px] text-txt-3 text-center py-12">
            No drivers match the current filters.
          </p>
        )}
      </div>
    </div>
  );
}
