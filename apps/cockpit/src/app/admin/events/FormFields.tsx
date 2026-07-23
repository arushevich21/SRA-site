'use client';

import { useState } from 'react';

// Shared field primitives for the Manage Events form. Each dropdown keeps a
// free-text escape hatch so the static catalog never blocks an admin.

export const labelCls = 'font-mono text-[11px] tracking-[.3em] uppercase text-txt-3';
export const inputCls =
  'mt-2 block w-full bg-carbon-2 border border-line text-txt font-mono text-sm px-3 py-2 focus:border-gold focus:outline-none';

const CUSTOM = '__custom__';

// Single-choice dropdown from `options`, with a "Custom…" entry that reveals a
// free-text input. A stored value not present in options is treated as custom.
export function SelectField({
  label, value, onChange, options, placeholder, required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
}) {
  const valueIsCustom = value !== '' && !options.includes(value);
  const [custom, setCustom] = useState(valueIsCustom);

  return (
    <label className={labelCls}>
      {label}{required && <span className="text-gold"> *</span>}
      <select
        className={inputCls}
        value={custom ? CUSTOM : value}
        onChange={(e) => {
          if (e.target.value === CUSTOM) {
            setCustom(true);
            onChange('');
          } else {
            setCustom(false);
            onChange(e.target.value);
          }
        }}
      >
        <option value="">{placeholder ?? '— Select —'}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
        <option value={CUSTOM}>Custom…</option>
      </select>
      {custom && (
        <input
          className={`${inputCls} mt-2`}
          value={value}
          placeholder="Type a custom value"
          autoFocus
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

// Multi-choice via toggle chips, plus an "add custom" input. Selected values
// not in `options` still render as removable chips (imported/legacy data).
export function MultiSelectField({
  label, value, onChange, options,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  options: string[];
}) {
  const [draft, setDraft] = useState('');

  function toggle(opt: string) {
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  }
  function addCustom() {
    const t = draft.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft('');
  }

  const extras = value.filter((v) => !options.includes(v));
  const allSelected = options.length > 0 && options.every((o) => value.includes(o));

  return (
    <div className={labelCls}>
      <div className="flex items-center gap-3 flex-wrap">
        <span>{label}</span>
        {options.length > 0 && (
          <div className="flex items-center gap-2 normal-case">
            <button
              type="button"
              onClick={() => onChange([...new Set([...value, ...options])])}
              disabled={allSelected}
              className="font-mono text-[10px] tracking-[.1em] uppercase text-gold hover:text-gold-soft transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default"
            >
              Select all
            </button>
            <span className="text-line">·</span>
            <button
              type="button"
              onClick={() => onChange(value.filter((v) => !options.includes(v)))}
              disabled={value.length === 0}
              className="font-mono text-[10px] tracking-[.1em] uppercase text-txt-3 hover:text-gold-deep transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default"
            >
              Clear
            </button>
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => toggle(o)}
              className={[
                'font-mono text-[11px] tracking-[.05em] normal-case px-2.5 py-1 border transition-colors cursor-pointer',
                on ? 'border-gold text-gold bg-gold/5' : 'border-line text-txt-3 hover:text-txt',
              ].join(' ')}
            >
              {on ? '✓ ' : ''}{o}
            </button>
          );
        })}
        {extras.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => toggle(o)}
            className="font-mono text-[11px] tracking-[.05em] normal-case px-2.5 py-1 border border-gold/60 text-gold bg-gold/5 cursor-pointer"
            title="Custom — click to remove"
          >
            ✓ {o} ✕
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          className={inputCls.replace('mt-2 ', '')}
          value={draft}
          placeholder="Add custom…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); addCustom(); }
          }}
        />
        <button
          type="button"
          onClick={addCustom}
          className="shrink-0 font-mono text-[11px] tracking-[.15em] uppercase text-gold border border-gold/40 px-3 hover:bg-gold/5 transition-colors cursor-pointer"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// Free-text input with a datalist of suggestions (type-ahead but any value ok).
export function ComboField({
  label, value, onChange, options, placeholder, listId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  listId: string;
}) {
  return (
    <label className={labelCls}>
      {label}
      <input
        className={inputCls}
        value={value}
        placeholder={placeholder}
        list={listId}
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={listId}>
        {options.map((o) => <option key={o} value={o} />)}
      </datalist>
    </label>
  );
}

// Round start time as an Eastern wall-clock string, preserving three states:
//   ''            → fully TBA (no date)
//   'YYYY-MM-DD'  → date known, time TBA
//   'YYYY-MM-DDThh:mm:00' → full date + time
// The native pickers write local wall-clock, which IS the Eastern value we
// store (interpreted DST-aware downstream by lib/event-time.ts).
export function RoundStartField({
  value, onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const [timeTba, setTimeTba] = useState(isDateOnly);

  const datePart = value.slice(0, 10); // works for '', date-only, and datetime

  function setTimeTbaMode(on: boolean) {
    setTimeTba(on);
    if (!value) return;
    if (on) onChange(datePart); // drop the time
    else if (datePart) onChange(`${datePart}T00:00:00`);
  }

  return (
    <div className={labelCls}>
      Starts at (Eastern; blank = TBA)
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {timeTba ? (
          <input
            type="date"
            className={inputCls.replace('mt-2 block w-full', 'block')}
            value={datePart}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <input
            type="datetime-local"
            className={inputCls.replace('mt-2 block w-full', 'block')}
            value={value.length >= 16 ? value.slice(0, 16) : ''}
            onChange={(e) => onChange(e.target.value ? `${e.target.value}:00` : '')}
          />
        )}
        <label className="flex items-center gap-2 cursor-pointer normal-case">
          <input
            type="checkbox"
            checked={timeTba}
            onChange={(e) => setTimeTbaMode(e.target.checked)}
            className="accent-gold w-4 h-4"
          />
          <span className="font-mono text-[11px] tracking-[.1em] uppercase text-txt-3">Time TBA</span>
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="font-mono text-[10px] tracking-[.15em] uppercase text-txt-3 hover:text-gold-deep cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
