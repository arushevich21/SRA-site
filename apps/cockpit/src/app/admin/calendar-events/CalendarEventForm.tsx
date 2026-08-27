'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveCalendarEvent, type CalendarEventInput } from './actions';
import { SIMS } from '@/content/sims';
import { SelectField, RoundStartField, labelCls, inputCls } from '../events/FormFields';

const GAMES = SIMS.map((s) => s.game);
const EVENT_TYPES: CalendarEventInput['eventType'][] = [
  'event',
  'deadline',
  'stream',
  'announcement',
];

export function CalendarEventForm({
  initial,
  isEdit,
}: {
  initial: CalendarEventInput;
  isEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState(initial);

  const set = <K extends keyof CalendarEventInput>(k: K, v: CalendarEventInput[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  function onSubmit() {
    setError(null);
    startTransition(async () => {
      const res = await saveCalendarEvent(f);
      if (res.ok) router.push('/admin/calendar-events');
      else setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="border border-gold-deep/30 bg-gold-deep/5 text-gold-deep px-4 py-3 font-mono text-[12px] tracking-[.1em]">
          {error}
        </div>
      )}

      <label className={labelCls}>
        Title<span className="text-gold"> *</span>
        <input
          className={inputCls}
          value={f.title}
          placeholder="Hot Stint Qualifying Closes"
          onChange={(e) => set('title', e.target.value)}
        />
      </label>

      <label className={labelCls}>
        Description
        <textarea
          className={`${inputCls} resize-y`}
          rows={2}
          value={f.description}
          placeholder="Shown as extra detail — optional"
          onChange={(e) => set('description', e.target.value)}
        />
      </label>

      <RoundStartField value={f.eventDate} onChange={(v) => set('eventDate', v)} />
      <p className="font-sans text-[12px] text-txt-3 -mt-3">
        Required. &quot;Time TBA&quot; renders as a date-only entry on the calendar.
      </p>

      <RoundStartField
        value={f.opensAt}
        onChange={(v) => set('opensAt', v)}
        label="Opens at (Eastern; optional — powers a progress bar)"
      />
      <p className="font-sans text-[12px] text-txt-3 -mt-3">
        Optional — only used by the Hot Stint Qualifying countdown (and similar deadline
        widgets) to draw an elapsed-time progress bar. Leave blank for a plain countdown.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <SelectField
          label="Sim (optional — blank shows on the cumulative calendar only)"
          value={f.game}
          onChange={(v) => set('game', v)}
          options={GAMES}
          placeholder="— Cumulative only —"
        />
        <label className={labelCls}>
          Type
          <select
            className={inputCls}
            value={f.eventType}
            onChange={(e) => set('eventType', e.target.value as CalendarEventInput['eventType'])}
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <label className={labelCls}>
          Link (optional)
          <input
            className={inputCls}
            value={f.href}
            placeholder="/acc/leaderboards/hotstint-qualifying or a full URL"
            onChange={(e) => set('href', e.target.value)}
          />
        </label>
        <label className={labelCls}>
          Color override (optional)
          <input
            className={inputCls}
            value={f.color}
            placeholder="#E04040 — defaults to the sim accent, or gold"
            onChange={(e) => set('color', e.target.value)}
          />
        </label>
      </div>

      <label className={labelCls}>
        Slug (optional — only needed if code looks this event up directly, e.g. a countdown)
        <input
          className={inputCls}
          value={f.slug}
          placeholder="acc-hot-stint-qualifying-deadline"
          onChange={(e) => set('slug', e.target.value)}
        />
      </label>

      <label className={labelCls}>
        Sort order
        <input
          className={inputCls}
          value={String(f.sortOrder)}
          onChange={(e) => set('sortOrder', Number(e.target.value) || 0)}
        />
      </label>

      <div className="flex items-center gap-4 border-t border-line pt-6">
        <button
          type="button"
          onClick={onSubmit}
          disabled={pending}
          className="bg-gold text-carbon font-mono text-[12px] tracking-[.2em] uppercase font-bold px-6 py-2.5 hover:bg-gold-soft transition-colors cursor-pointer disabled:opacity-50"
        >
          {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create event'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/calendar-events')}
          className="font-mono text-[12px] tracking-[.2em] uppercase text-txt-3 hover:text-gold cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
