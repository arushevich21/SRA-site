'use client';

import { useState, useTransition } from 'react';
import type { PurgeData } from '@/lib/driver-numbers';
import { setLock, setPreserve, purgeNumbers } from './actions';

export default function NumbersAdmin({
  locked,
  purge,
}: {
  locked: boolean;
  purge: PurgeData;
}) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState<string | null>(null);

  function toggleLock() {
    startTransition(async () => {
      await setLock(!locked);
      setNote(!locked ? 'Numbers locked.' : 'Numbers unlocked.');
    });
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function markImmune(id: string) {
    startTransition(async () => {
      await setPreserve(id, true);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setNote('Marked immune — the row will drop off on refresh.');
    });
  }

  function doPurge() {
    if (selected.size === 0) return;
    if (
      !confirm(
        `Purge ${selected.size} driver number(s)? Their driver_number will be cleared.`,
      )
    )
      return;
    startTransition(async () => {
      const { purged } = await purgeNumbers([...selected]);
      setSelected(new Set());
      setNote(`Purged ${purged} number(s).`);
    });
  }

  return (
    <div className="flex flex-col gap-12 max-w-[860px]">
      {/* ── Lock ─────────────────────────────────────────────────────────── */}
      <div className="border border-line bg-panel px-7 py-6">
        <p className="font-mono text-[11px] tracking-[.35em] uppercase text-gold mb-3">
          Mid-Season Lock
        </p>
        <p className="font-sans text-[14px] text-txt-2 leading-relaxed mb-5">
          When locked, drivers can&apos;t change their number from the profile
          page. Admins can always change numbers.
        </p>
        <div className="flex items-center gap-4">
          <span
            className={[
              'font-mono text-[12px] tracking-[.2em] uppercase px-3 py-1 border',
              locked
                ? 'border-red-400/50 text-red-400'
                : 'border-green-400/50 text-green-400',
            ].join(' ')}
          >
            {locked ? 'Locked' : 'Unlocked'}
          </span>
          <button
            onClick={toggleLock}
            disabled={pending}
            className="font-mono text-[12px] tracking-[.15em] uppercase px-5 py-3 bg-gold text-carbon font-bold hover:bg-gold-soft transition-colors disabled:opacity-50"
          >
            {locked ? 'Unlock numbers' : 'Lock numbers'}
          </button>
        </div>
      </div>

      {/* ── Purge ────────────────────────────────────────────────────────── */}
      <div className="border border-line bg-panel px-7 py-6">
        <p className="font-mono text-[11px] tracking-[.35em] uppercase text-gold mb-3">
          Purge Inactive Numbers
        </p>
        <p className="font-sans text-[14px] text-txt-2 leading-relaxed mb-5">
          Drivers inactive in ≥2 of the last 3 team-series seasons. Admins,
          champion #1, held numbers, and numbers marked immune are excluded.
        </p>

        {!purge.ready ? (
          <p className="font-mono text-[13px] text-txt-3">
            Not enough team-series history yet ({purge.seasonCount}/3 seasons
            recorded). The purge activates once 3 seasons have run on the new
            site.
          </p>
        ) : purge.candidates.length === 0 ? (
          <p className="font-mono text-[13px] text-txt-3">
            No inactive numbered drivers across seasons{' '}
            {purge.seasons.join(', ')}.
          </p>
        ) : (
          <>
            <p className="font-mono text-[11px] text-txt-3 mb-4">
              Window: {purge.seasons.join(', ')} · {purge.candidates.length}{' '}
              candidate(s)
            </p>
            <div className="border border-line divide-y divide-line mb-5">
              {purge.candidates.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-panel-2"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                    className="accent-gold"
                  />
                  <span className="font-display font-black text-[16px] text-gold tabular-nums w-12 shrink-0">
                    {c.number}
                  </span>
                  <span className="font-mono text-[13px] text-txt truncate flex-1">
                    {c.name}
                  </span>
                  <span className="font-mono text-[10px] tracking-[.2em] uppercase text-txt-3 shrink-0">
                    {c.activeCount}/3 active
                  </span>
                  <button
                    onClick={() => markImmune(c.id)}
                    disabled={pending}
                    className="font-mono text-[10px] tracking-[.15em] uppercase text-txt-3 hover:text-gold transition-colors shrink-0 disabled:opacity-50"
                  >
                    Mark immune
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={doPurge}
                disabled={pending || selected.size === 0}
                className="font-mono text-[12px] tracking-[.15em] uppercase px-5 py-3 border border-red-400/50 text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
              >
                Purge selected ({selected.size})
              </button>
              <button
                onClick={() =>
                  setSelected(new Set(purge.candidates.map((c) => c.id)))
                }
                className="font-mono text-[11px] tracking-[.15em] uppercase text-txt-3 hover:text-txt transition-colors"
              >
                Select all
              </button>
            </div>
          </>
        )}
      </div>

      {note && (
        <p className="font-mono text-[12px] tracking-[.1em] uppercase text-green-400">
          {note}
        </p>
      )}
    </div>
  );
}
