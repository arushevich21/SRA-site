'use client';

import { useMemo, useState, useTransition } from 'react';
import { accCarModelName } from '@sra/domain';
import {
  BOP_CAR_MODELS,
  BOP_TRACKS,
  clampBallast,
  clampRestrictor,
} from '@/content/bop';
import { saveBop, type BopEntry } from './actions';

export type BopCell = {
  track: string;
  carModel: number;
  ballastKg: number;
  restrictor: number;
};

type Field = 'ballast' | 'restrictor';
type Values = Record<string, { ballast: number; restrictor: number }>;

const cellKey = (track: string, carModel: number) => `${track}:${carModel}`;

function buildValues(cells: BopCell[]): Values {
  const v: Values = {};
  for (const c of cells) {
    v[cellKey(c.track, c.carModel)] = { ballast: c.ballastKg, restrictor: c.restrictor };
  }
  return v;
}

export default function BopEditor({
  initialCells,
  bopId,
  bopName,
}: {
  initialCells: BopCell[];
  bopId: string;
  bopName: string;
}) {
  const [values, setValues] = useState<Values>(() => buildValues(initialCells));
  const [field, setField] = useState<Field>('ballast');
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  // Preserve the preset's identity for round-tripping; an imported file can
  // override it so a re-download matches what ACCSM expects.
  const [presetId, setPresetId] = useState(bopId);
  const [presetName, setPresetName] = useState(bopName);

  const carNames = useMemo(
    () => BOP_CAR_MODELS.map((id) => ({ id, name: accCarModelName(id) ?? `Car ${id}` })),
    [],
  );

  function getVal(track: string, car: number, f: Field): number {
    return values[cellKey(track, car)]?.[f] ?? 0;
  }

  function writeVal(track: string, car: number, f: Field, next: number) {
    const clamped = f === 'ballast' ? clampBallast(next) : clampRestrictor(next);
    setValues((prev) => {
      const key = cellKey(track, car);
      const cur = prev[key] ?? { ballast: 0, restrictor: 0 };
      return { ...prev, [key]: { ...cur, [f]: clamped } };
    });
  }

  function setVal(track: string, car: number, f: Field, raw: string) {
    const n = raw === '' || raw === '-' ? 0 : Number(raw);
    if (Number.isNaN(n)) return;
    writeVal(track, car, f, n);
  }

  // Spinner steppers move in increments of 5 (BoP values are always ×5).
  function bump(track: string, car: number, f: Field, delta: number) {
    writeVal(track, car, f, getVal(track, car, f) + delta);
  }

  function collectEntries(): BopEntry[] {
    const out: BopEntry[] = [];
    for (const t of BOP_TRACKS) {
      for (const car of BOP_CAR_MODELS) {
        const v = values[cellKey(t.key, car)];
        if (!v) continue;
        if (v.ballast === 0 && v.restrictor === 0) continue;
        out.push({ track: t.key, carModel: car, ballastKg: v.ballast, restrictor: v.restrictor });
      }
    }
    return out;
  }

  function onSave() {
    setMsg(null);
    startTransition(async () => {
      const res = await saveBop(collectEntries());
      setMsg(res.ok ? 'Saved.' : `Save failed: ${res.error}`);
    });
  }

  function onDownload() {
    const doc = {
      id: presetId || crypto.randomUUID(),
      name: presetName || 'Default',
      date: new Date().toISOString(),
      entries: collectEntries().map((e) => ({
        track: e.track,
        carModel: e.carModel,
        ballastKg: e.ballastKg,
        restrictor: e.restrictor,
      })),
    };
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bop.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMsg(null);
    try {
      const parsed = JSON.parse(await file.text()) as {
        id?: string;
        name?: string;
        entries?: { track: string; carModel: number; ballastKg?: number; restrictor?: number }[];
      };
      if (!Array.isArray(parsed.entries)) throw new Error('No "entries" array in file');
      const next: Values = {};
      for (const en of parsed.entries) {
        if (!en.track || typeof en.carModel !== 'number') continue;
        next[cellKey(en.track, en.carModel)] = {
          ballast: clampBallast(en.ballastKg ?? 0),
          restrictor: clampRestrictor(en.restrictor ?? 0),
        };
      }
      setValues(next);
      if (parsed.id) setPresetId(parsed.id);
      if (parsed.name) setPresetName(parsed.name);
      setMsg(`Imported ${parsed.entries.length} entries — review, then Save to persist.`);
    } catch (err) {
      setMsg(`Import failed: ${err instanceof Error ? err.message : 'invalid file'}`);
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex border border-line">
          {(['ballast', 'restrictor'] as Field[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setField(f)}
              className={[
                'font-mono text-[11px] tracking-[.2em] uppercase px-4 py-2 transition-colors',
                field === f ? 'bg-gold text-carbon font-bold' : 'text-txt-3 hover:text-txt',
              ].join(' ')}
            >
              {f === 'ballast' ? 'Ballast' : 'Restrictor'}
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          {msg && <span className="font-mono text-[11px] text-txt-3">{msg}</span>}
          <label className="font-mono text-[11px] tracking-[.15em] uppercase px-4 py-2 border border-line text-txt-2 hover:border-gold/50 hover:text-gold transition-colors cursor-pointer">
            Import bop.json
            <input type="file" accept="application/json,.json" onChange={onImport} className="hidden" />
          </label>
          <button
            type="button"
            onClick={onDownload}
            className="font-mono text-[11px] tracking-[.15em] uppercase px-4 py-2 border border-line text-txt-2 hover:border-gold/50 hover:text-gold transition-colors"
          >
            Download bop.json ↓
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            className="font-mono text-[11px] tracking-[.2em] uppercase px-5 py-2 bg-gold text-carbon font-bold hover:bg-gold-soft transition-colors disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <p className="font-mono text-[10px] text-txt-3 mb-3">
        {field === 'ballast' ? 'Ballast kg (−40 … 40)' : 'Restrictor (0 … 40)'} · blank = no change
      </p>

      {/* Grid */}
      <div className="overflow-x-auto border border-line">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 bg-panel-2 border-b border-r border-line px-3 py-2 text-left font-mono text-[10px] tracking-[.2em] uppercase text-txt-3 min-w-[150px]">
                Track
              </th>
              {carNames.map((c) => (
                <th
                  key={c.id}
                  className="bg-panel-2 border-b border-line px-1 py-2 align-bottom min-w-[78px] max-w-[78px]"
                >
                  <span className="block font-mono text-[9px] leading-tight text-txt-2 text-center">
                    {c.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BOP_TRACKS.map((t, ri) => (
              <tr key={t.key} className={ri % 2 ? 'bg-panel/40' : ''}>
                <td className="sticky left-0 z-10 bg-panel border-r border-line px-3 py-1.5 font-mono text-[11px] text-txt whitespace-nowrap">
                  {t.displayName}
                </td>
                {BOP_CAR_MODELS.map((car) => {
                  const v = getVal(t.key, car, field);
                  return (
                    <td key={car} className="border border-line/40 p-0">
                      <div className="flex items-stretch h-8">
                        <input
                          inputMode="numeric"
                          value={v === 0 ? '' : String(v)}
                          onChange={(e) => setVal(t.key, car, field, e.target.value)}
                          className={[
                            'w-full min-w-0 bg-transparent text-center font-mono text-[11px] focus:bg-gold/10 focus:outline-none',
                            v > 0 ? 'text-live' : v < 0 ? 'text-active-closed' : 'text-txt',
                          ].join(' ')}
                        />
                        <div className="flex flex-col shrink-0 border-l border-line/40">
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => bump(t.key, car, field, 5)}
                            className="flex-1 px-1 leading-none text-[8px] text-txt-3 hover:text-gold hover:bg-gold/10 transition-colors"
                            aria-label="Increase 5"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => bump(t.key, car, field, -5)}
                            className="flex-1 px-1 leading-none text-[8px] text-txt-3 hover:text-gold hover:bg-gold/10 border-t border-line/40 transition-colors"
                            aria-label="Decrease 5"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
