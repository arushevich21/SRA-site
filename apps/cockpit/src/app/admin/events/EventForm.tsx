'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  saveChampionship,
  uploadChampionshipLogo,
  type ChampionshipInput,
  type ChampionshipRoundInput,
} from './actions';
import { blankRound } from './blank';
import { SIMS } from '@/content/sims';
import { getGameCatalog } from '@/content/sim-catalog';
import {
  SelectField,
  MultiSelectField,
  ComboField,
  RoundStartField,
} from './FormFields';

const GAMES = SIMS.map((s) => s.game);

// ── small presentational helpers ──────────────────────────────────────────────
const labelCls = 'font-mono text-[11px] tracking-[.3em] uppercase text-txt-3';
const inputCls =
  'mt-2 block w-full bg-carbon-2 border border-line text-txt font-mono text-sm px-3 py-2 focus:border-gold focus:outline-none';

function Text({
  label, value, onChange, placeholder, required,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean;
}) {
  return (
    <label className={labelCls}>
      {label}{required && <span className="text-gold"> *</span>}
      <input className={inputCls} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Area({
  label, value, onChange, placeholder, rows = 3,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <label className={labelCls}>
      {label}
      <textarea className={`${inputCls} resize-y`} rows={rows} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Check({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)}
        className="accent-gold w-4 h-4" />
      <span className={labelCls}>{label}</span>
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line pt-6">
      <h3 className="font-display font-bold text-[16px] uppercase text-gold mb-4">{title}</h3>
      <div className="flex flex-col gap-5">{children}</div>
    </div>
  );
}

// multiline <-> array helpers
const linesToArr = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);
const arrToLines = (a: string[]) => a.join('\n');

function parseDiscord(s: string): { label: string; url: string }[] {
  return s.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
    const [label, url] = line.split('|').map((p) => p.trim());
    return { label: label ?? '', url: url ?? '' };
  }).filter((d) => d.label && d.url);
}
const discordToLines = (d: { label: string; url: string }[]) => d.map((x) => `${x.label} | ${x.url}`).join('\n');

export function EventForm({ initial, isEdit }: { initial: ChampionshipInput; isEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Core fields
  const [f, setF] = useState(initial);
  // Raw text mirrors for the free-text list fields (rules/discord stay textareas)
  const [rulesRaw, setRulesRaw] = useState(arrToLines(initial.rulesBullets));
  const [discordRaw, setDiscordRaw] = useState(discordToLines(initial.discordLinks));

  const set = <K extends keyof ChampionshipInput>(k: K, v: ChampionshipInput[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  // Game-scoped pick lists — recomputed when the selected game changes.
  const catalog = getGameCatalog(f.game);

  function updateRound(i: number, patch: Partial<ChampionshipRoundInput>) {
    setF((prev) => ({ ...prev, rounds: prev.rounds.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  }
  function addRound() {
    setF((prev) => ({ ...prev, rounds: [...prev.rounds, blankRound(prev.rounds.length + 1)] }));
  }
  function removeRound(i: number) {
    setF((prev) => ({
      ...prev,
      rounds: prev.rounds.filter((_, j) => j !== i).map((r, j) => ({ ...r, round: j + 1 })),
    }));
  }

  async function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    // Guard the size client-side too: an over-limit body is rejected by Next's
    // Server Action body cap and throws before the action's own check runs.
    if (file.size > 2 * 1024 * 1024) {
      setUploading(false);
      setError('Image must be under 2 MB.');
      e.target.value = '';
      return;
    }
    try {
      const fd = new FormData();
      fd.set('file', file);
      const res = await uploadChampionshipLogo(fd);
      if (res.ok) set('logoUrl', res.id);
      else setError(res.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logo upload failed.');
    } finally {
      setUploading(false);
    }
  }

  function onSubmit() {
    setError(null);
    const payload: ChampionshipInput = {
      ...f,
      rulesBullets: linesToArr(rulesRaw),
      discordLinks: parseDiscord(discordRaw),
    };
    startTransition(async () => {
      const res = await saveChampionship(payload);
      if (res.ok) router.push('/admin/events');
      else setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <div className="border border-gold-deep/30 bg-gold-deep/5 text-gold-deep px-4 py-3 font-mono text-[12px] tracking-[.1em]">
          {error}
        </div>
      )}

      <Section title="Identity">
        <Text label="Title" value={f.title} onChange={(v) => set('title', v)} required
          placeholder="SRA GT3 Endurance Series — Season 3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Text label="Slug" value={f.slug} onChange={(v) => set('slug', v)} required
            placeholder="gt3-endurance-s3" />
          <label className={labelCls}>
            Game <span className="text-gold">*</span>
            <select className={inputCls} value={f.game} onChange={(e) => set('game', e.target.value)}>
              {GAMES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <SelectField label="Class Tag" value={f.classTag} onChange={(v) => set('classTag', v)}
            options={catalog.classTags} required placeholder="— Select —" />
          <SelectField label="Format Tag" value={f.formatTag} onChange={(v) => set('formatTag', v)}
            options={catalog.formatTags} placeholder="— Select —" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <label className={labelCls}>
            Event Type
            <select className={inputCls} value={f.eventType}
              onChange={(e) => set('eventType', e.target.value as 'championship' | 'exhibition')}>
              <option value="championship">championship</option>
              <option value="exhibition">exhibition</option>
            </select>
          </label>
          <MultiSelectField label="Classes" value={f.classes} onChange={(v) => set('classes', v)}
            options={catalog.classes} />
        </div>
      </Section>

      <Section title="Logo">
        <div className="flex items-center gap-5">
          {f.logoUrl && (
            <Image src={f.logoUrl} alt="" width={72} height={72}
              className="w-[72px] h-[72px] object-contain border border-line bg-carbon-2 p-1" unoptimized />
          )}
          <div className="flex flex-col gap-2">
            <input type="file" accept="image/*" onChange={onLogoChange}
              className="text-sm text-txt-3 font-mono file:bg-carbon-2 file:border file:border-line file:text-txt-2 file:font-mono file:text-xs file:px-3 file:py-1.5 file:cursor-pointer file:mr-3" />
            {uploading && <span className="font-mono text-[11px] text-txt-3">Uploading…</span>}
            <Text label="…or paste a logo URL / path" value={f.logoUrl} onChange={(v) => set('logoUrl', v)}
              placeholder="/badges/endurance-series_logo.png" />
          </div>
        </div>
      </Section>

      <Section title="Details">
        <Text label="Race Format" value={f.raceFormat} onChange={(v) => set('raceFormat', v)}
          placeholder="65 min stint timer · Refueling not fixed · Unlimited tires" />
        <Text label="Race Days" value={f.raceDays} onChange={(v) => set('raceDays', v)}
          placeholder="Saturdays" />
        <Area label="Rules bullets (one per line)" value={rulesRaw} onChange={setRulesRaw} rows={5}
          placeholder={'1–4 drivers per team\n3 divisions: Open, Silver, Bronze'} />
        <Area label="Discord links (one per line: Label | https://url)" value={discordRaw} onChange={setDiscordRaw}
          placeholder={'Series Rules | https://discord.com/...\nSchedule | /acc/championships/.../calendar'} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Text label="Results URL" value={f.resultsUrl} onChange={(v) => set('resultsUrl', v)}
            placeholder="https://thesimgrid.com/championships/22872" />
          <Text label="Results label" value={f.resultsLabel} onChange={(v) => set('resultsLabel', v)}
            placeholder="View on SimGrid" />
        </div>
      </Section>

      <Section title="Link to data source (optional)">
        <p className="font-sans text-[13px] text-txt-3 -mt-2">
          These only <em>link</em> the site to results you created elsewhere. Creating the event in
          ACSM (the server manager) is still done by hand in its web UI — nothing here writes to it.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Text label="ACSM championship ID" value={f.emperorChampionshipId}
            onChange={(v) => set('emperorChampionshipId', v)} placeholder="3a2e4266-ff5f-…" />
          <Text label="SimGrid ID" value={f.simgridId} onChange={(v) => set('simgridId', v)} placeholder="22872" />
        </div>
        <Text label="Standings key (manual-upload store)" value={f.standingsKey}
          onChange={(v) => set('standingsKey', v)} placeholder="endurance-s3" />
      </Section>

      <Section title="Registration (optional)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Text label="Registration key" value={f.registrationKey} onChange={(v) => set('registrationKey', v)}
            placeholder="acc-gt3-s19" />
          <Text label="Registration season" value={f.registrationSeason}
            onChange={(v) => set('registrationSeason', v)} placeholder="s19" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <label className={labelCls}>
            Max team size
            <select className={inputCls} value={f.maxTeamSize}
              onChange={(e) => set('maxTeamSize', e.target.value)}>
              <option value="">— None —</option>
              {['1', '2', '3', '4'].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <div className="flex items-end"><Check label="Registration open" value={f.registrationOpen}
            onChange={(v) => set('registrationOpen', v)} /></div>
        </div>
        <MultiSelectField label="Allowed cars" value={f.allowedCars} onChange={(v) => set('allowedCars', v)}
          options={catalog.cars} />
      </Section>

      <Section title="Rounds">
        <div className="flex flex-col gap-4">
          {f.rounds.map((r, i) => (
            <div key={i} className="border border-line bg-carbon-2 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[12px] tracking-[.2em] uppercase text-gold">Round {r.round}</span>
                <button type="button" onClick={() => removeRound(i)}
                  className="font-mono text-[11px] tracking-[.15em] uppercase text-txt-3 hover:text-gold-deep cursor-pointer">
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SelectField label="Track" value={r.track}
                  options={catalog.tracks.map((t) => t.displayName)} placeholder="— Select track —"
                  onChange={(v) => {
                    // Picking a catalogued track auto-fills its Emperor identifiers
                    // (AC Evo only — ACC/LMU have none). Custom entries clear them.
                    const t = catalog.tracks.find((ct) => ct.displayName === v);
                    updateRound(i, {
                      track: v,
                      emperorTrack: t?.emperorTrack ?? '',
                      emperorRawTrackName: t?.emperorRawTrackName ?? '',
                    });
                  }} />
                <ComboField label="Race length" value={r.raceLength} listId={`race-len-${i}`}
                  options={catalog.raceLengths} placeholder="30 min"
                  onChange={(v) => updateRound(i, { raceLength: v })} />
                <RoundStartField value={r.startsAt}
                  onChange={(v) => updateRound(i, { startsAt: v })} />
                {f.game === 'AC Evo' && (
                  <>
                    <Text label="ACSM track,layout" value={r.emperorTrack}
                      onChange={(v) => updateRound(i, { emperorTrack: v })} placeholder="Circuit Of The Americas,National" />
                    <Text label="ACSM raw track name" value={r.emperorRawTrackName}
                      onChange={(v) => updateRound(i, { emperorRawTrackName: v })} placeholder="Circuit Of The Americas" />
                  </>
                )}
              </div>
              {f.game === 'ACC' && (
                <div className="mt-3 pt-3 border-t border-line/50">
                  <Check
                    label="Release hot-lap leaderboard (Seasonal)"
                    value={r.hotlapReleased}
                    onChange={(v) => updateRound(i, { hotlapReleased: v })}
                  />
                  <p className="font-sans text-[12px] text-txt-3 mt-1.5">
                    When on, this round&apos;s hot-lap board shows on the Seasonal
                    leaderboard. Leave off until you want it public.
                  </p>
                </div>
              )}
            </div>
          ))}
          <button type="button" onClick={addRound}
            className="self-start font-mono text-[12px] tracking-[.2em] uppercase text-gold border border-gold/40 px-4 py-2 hover:bg-gold/5 transition-colors cursor-pointer">
            + Add round
          </button>
        </div>
      </Section>

      <Section title="Display">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Text label="Sort order" value={String(f.sortOrder)}
            onChange={(v) => set('sortOrder', Number(v) || 0)} placeholder="0" />
          <div className="flex items-end gap-6">
            <Check label="Teaser only" value={f.teaserOnly} onChange={(v) => set('teaserOnly', v)} />
            <Check label="Concluded" value={f.concluded} onChange={(v) => set('concluded', v)} />
          </div>
        </div>
      </Section>

      <div className="flex items-center gap-4 border-t border-line pt-6">
        <button type="button" onClick={onSubmit} disabled={pending || uploading}
          className="bg-gold text-carbon font-mono text-[12px] tracking-[.2em] uppercase font-bold px-6 py-2.5 hover:bg-gold-soft transition-colors cursor-pointer disabled:opacity-50">
          {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create event'}
        </button>
        <button type="button" onClick={() => router.push('/admin/events')}
          className="font-mono text-[12px] tracking-[.2em] uppercase text-txt-3 hover:text-gold cursor-pointer">
          Cancel
        </button>
      </div>
    </div>
  );
}
