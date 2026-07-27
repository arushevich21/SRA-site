'use client';

import { useState } from 'react';

export type TakenEntry = { name: string; reserved: boolean };

type Result =
  | { kind: 'available' | 'taken' | 'reserved' | 'champion' | 'invalid'; msg: string }
  | null;

export default function NumberChecker({
  takenMap,
  min,
  max,
}: {
  takenMap: Record<number, TakenEntry>;
  min: number;
  max: number;
}) {
  const [value, setValue] = useState('');
  const [result, setResult] = useState<Result>(null);

  function check(raw: string) {
    setValue(raw);
    const trimmed = raw.trim();
    if (trimmed === '') {
      setResult(null);
      return;
    }
    const n = Number(trimmed);
    if (!Number.isInteger(n)) {
      setResult({ kind: 'invalid', msg: 'Enter a whole number.' });
      return;
    }
    // #1 is the champion's number — never user-pickable.
    if (n === 1) {
      const holder = takenMap[1];
      setResult({
        kind: 'champion',
        msg: holder
          ? `#1 is held by ${holder.name}, the reigning Division 1 champion.`
          : '#1 is reserved for the reigning Division 1 champion.',
      });
      return;
    }
    if (n < min || n > max) {
      setResult({ kind: 'invalid', msg: `Numbers run from ${min} to ${max}.` });
      return;
    }
    const entry = takenMap[n];
    if (entry?.reserved) {
      setResult({
        kind: 'reserved',
        msg: `#${n} is held for ${entry.name}'s return from #1 — reserved.`,
      });
      return;
    }
    if (entry) {
      setResult({ kind: 'taken', msg: `#${n} is taken by ${entry.name}.` });
      return;
    }
    setResult({ kind: 'available', msg: `#${n} is available.` });
  }

  const color =
    result?.kind === 'available'
      ? 'text-green-400'
      : result?.kind === 'taken' || result?.kind === 'reserved'
        ? 'text-red-400'
        : 'text-gold';

  return (
    <div className="max-w-[440px] border border-line bg-panel px-6 py-6">
      <label
        htmlFor="num"
        className="block font-mono text-[11px] tracking-[.25em] uppercase text-txt-3 mb-3"
      >
        Check a number
      </label>
      <input
        id="num"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(e) => check(e.target.value)}
        placeholder="e.g. 24"
        className="bg-panel-2 border border-line px-4 py-3 font-mono text-[15px] text-txt placeholder:text-txt-3 focus:outline-none focus:border-gold w-full"
      />
      {result && (
        <p className={`mt-4 font-mono text-[13px] leading-relaxed ${color}`}>
          {result.kind === 'available' && '✓ '}
          {(result.kind === 'taken' || result.kind === 'reserved') && '✕ '}
          {result.msg}
        </p>
      )}
    </div>
  );
}
