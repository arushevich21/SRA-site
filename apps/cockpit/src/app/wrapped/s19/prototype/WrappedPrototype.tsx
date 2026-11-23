'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { WrappedDriverCard, WrappedRosterEntry } from '@/lib/wrapped/s19-prototype';
import './wrapped.css';

const SLIDES = 3;
const GOLD = '#e6b53d';
const MUTED = 'rgba(233,235,239,.32)';

const fmt = (n: number, digits = 0) =>
  n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return reduced;
}

// Counts up in step with the hero's rise (starts with it, 900ms ease-out).
function CountUp({ value, digits = 0, run }: { value: number; digits?: number; run: boolean }) {
  const [shown, setShown] = useState(run ? 0 : value);
  useEffect(() => {
    if (!run) {
      setShown(value);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const tick = (t: number) => {
      start ??= t;
      const p = Math.min((t - start - 160) / 900, 1);
      setShown(value * (1 - Math.pow(1 - Math.max(p, 0), 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, run]);
  return <>{fmt(shown, digits)}</>;
}

const at = (ms: number, rise?: number): CSSProperties =>
  ({ '--d': `${ms}ms`, ...(rise != null ? { '--rise': `${rise}px` } : {}) }) as CSSProperties;

// ── Charts ──────────────────────────────────────────────────────────────────

// Season strip: one bar per round, taller = better finish; best round in gold.
function SeasonStrip({ rounds }: { rounds: WrappedDriverCard['rounds'] }) {
  const W = 380;
  const H = 190;
  const base = 158;
  const maxBar = 118;
  const col = W / rounds.length;
  const finishes = rounds.map((r) => r.position).filter((p): p is number => p != null);
  const best = finishes.length ? Math.min(...finishes) : null;
  // Scale to the driver's own range, not the 35-car field — against the whole
  // grid, P1 and P3 were indistinguishable. Floor of P8 so a season of P1–P2
  // doesn't make a P2 look like a disaster.
  const worst = Math.max(8, ...finishes);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Finishing position each round: ${rounds.map((r) => `${r.track} ${r.position != null ? `P${r.position}` : 'did not start'}`).join(', ')}`}>
      <line x1="0" x2={W} y1={base} y2={base} stroke="var(--color-line-2)" strokeWidth="1" />
      {rounds.map((r, i) => {
        const cx = col * i + col / 2;
        const bw = Math.min(26, col * 0.5);
        if (r.position == null)
          return (
            <g key={r.round}>
              <line x1={cx - bw / 2} x2={cx + bw / 2} y1={base - 1} y2={base - 1} stroke={MUTED} strokeDasharray="3 3" />
              <text x={cx} y={base - 10} textAnchor="middle" className="wr-axis">DNS</text>
              <text x={cx} y={H - 12} textAnchor="middle" className="wr-axis">{r.code}</text>
            </g>
          );
        const h = Math.max(8, (1 - ((r.position - 1) / worst) * 0.9) * maxBar);
        const isBest = r.position === best;
        return (
          <g key={r.round}>
            <rect
              className="wr-bar"
              style={{ '--i': i } as CSSProperties}
              x={cx - bw / 2}
              y={base - h}
              width={bw}
              height={h}
              fill={isBest ? GOLD : MUTED}
            />
            <text x={cx} y={base - h - 7} textAnchor="middle" className="wr-val" style={isBest ? { fill: GOLD } : undefined}>
              P{r.position}
            </text>
            <text x={cx} y={H - 12} textAnchor="middle" className="wr-axis">{r.code}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Rivalry: both drivers' finishing positions across the season, P1 at the top.
// A hairline joins the pair on rounds they finished side by side.
function RivalryChart({ rivalry, them }: { rivalry: WrappedDriverCard['rivalry']; them: string }) {
  const W = 380;
  const H = 200;
  const L = 30;
  const R = 12;
  const T = 14;
  const B = 34;
  const all = rivalry.flatMap((r) => [r.me, r.them]).filter((p): p is number => p != null);
  const maxPos = Math.max(2, ...all);
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, rivalry.length - 1);
  const y = (p: number) => T + ((p - 1) / (maxPos - 1)) * (H - T - B);
  const path = (key: 'me' | 'them') => {
    let d = '';
    let pen = false;
    rivalry.forEach((r, i) => {
      const p = r[key];
      if (p == null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p).toFixed(1)} `;
      pen = true;
    });
    return d.trim();
  };
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Your finishing position and ${them}'s, round by round`}>
        <text x={L - 8} y={y(1) + 3} textAnchor="end" className="wr-axis">P1</text>
        <text x={L - 8} y={y(maxPos) + 3} textAnchor="end" className="wr-axis">P{maxPos}</text>
        {rivalry.map((r, i) => (
          <g key={r.round}>
            <line x1={x(i)} x2={x(i)} y1={T} y2={H - B} stroke="var(--color-line)" strokeWidth="1" />
            <text x={x(i)} y={H - 12} textAnchor="middle" className="wr-axis">{r.code}</text>
            {r.me != null && r.them != null && Math.abs(r.me - r.them) === 1 && (
              <line className="wr-dot" x1={x(i)} x2={x(i)} y1={y(r.me)} y2={y(r.them)} stroke="#fff" strokeWidth="2" />
            )}
          </g>
        ))}
        <path className="wr-line" d={path('them')} pathLength={1} fill="none" stroke={MUTED} strokeWidth="2" strokeLinejoin="round" />
        <path className="wr-line" d={path('me')} pathLength={1} fill="none" stroke={GOLD} strokeWidth="3" strokeLinejoin="round" />
        {rivalry.map((r, i) => (
          <g key={`d${r.round}`} className="wr-dot">
            {r.them != null && <circle cx={x(i)} cy={y(r.them)} r="3.5" fill="#0e1014" stroke={MUTED} strokeWidth="2" />}
            {r.me != null && <circle cx={x(i)} cy={y(r.me)} r="4.5" fill={GOLD} />}
          </g>
        ))}
      </svg>
      <div className="flex gap-5 mt-1 font-mono text-[9.5px] tracking-[.16em] uppercase text-txt-3">
        <span className="flex items-center gap-2"><i className="inline-block w-4 h-[3px]" style={{ background: GOLD }} />You</span>
        <span className="flex items-center gap-2"><i className="inline-block w-4 h-[2px]" style={{ background: MUTED }} />{them}</span>
      </div>
    </div>
  );
}

// Field plot: every driver in the comparison group as a dot (stacked where
// they'd overlap), the driver as a gold dot that lands last.
function FieldPlot({ field }: { field: WrappedDriverCard['field'] }) {
  const W = 380;
  const H = 150;
  const L = 10;
  const R = 10;
  const axisY = 118;
  const lo = Math.min(field.mine, ...field.values);
  const hi = Math.max(field.mine, ...field.values);
  const span = hi - lo || 1;
  const x = (v: number) => L + ((v - lo) / span) * (W - L - R);
  const bins = new Map<number, number>();
  const dots = field.values.map((v) => {
    const bx = Math.round(x(v) / 8);
    const k = bins.get(bx) ?? 0;
    bins.set(bx, k + 1);
    return { cx: bx * 8, cy: axisY - 8 - k * 7 };
  });
  const youX = x(field.mine);
  const label = (v: number) => (Number.isInteger(v) ? fmt(v) : v.toFixed(1));
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${field.label}: you ${label(field.mine)}, field from ${label(lo)} to ${label(hi)}`}>
        <line x1={L} x2={W - R} y1={axisY} y2={axisY} stroke="var(--color-line-2)" />
        <g className="wr-field">
          {dots.map((d, i) => (
            <circle key={i} cx={d.cx} cy={d.cy} r="3" fill={MUTED} />
          ))}
        </g>
        <g className="wr-you">
          <line x1={youX} x2={youX} y1={26} y2={axisY} stroke={GOLD} strokeWidth="1.5" />
          <circle cx={youX} cy={26} r="6" fill={GOLD} />
          <text x={youX} y={12} textAnchor="middle" className="wr-val" style={{ fill: GOLD }}>
            YOU · {label(field.mine)}
          </text>
        </g>
        <text x={L} y={axisY + 16} className="wr-axis">{label(lo)}</text>
        <text x={W - R} y={axisY + 16} textAnchor="end" className="wr-axis">{label(hi)}</text>
      </svg>
      <p className="font-mono text-[9.5px] tracking-[.16em] uppercase text-txt-3 mt-1">{field.label}</p>
    </div>
  );
}

// ── Slides ──────────────────────────────────────────────────────────────────

function Slide({ card, index, animate }: { card: WrappedDriverCard; index: number; animate: boolean }) {
  const n = card.numbers;
  const kicker = (text: string) => (
    <span className="wr-kicker wr-fade" style={at(0)}>
      {text}
    </span>
  );

  if (index === 0) {
    const minutes = Math.round(n.hours * 60);
    return (
      <>
        {kicker('Season 19 in numbers')}
        <div className="flex-1 flex items-center">
          <SeasonStrip rounds={card.rounds} />
        </div>
        <div className="wr-hero wr-rise" style={at(160, 28)}>
          <CountUp value={n.km} run={animate} />
          <small> km</small>
        </div>
        <p className="wr-support wr-rise mt-2" style={at(280, 10)}>
          {card.distanceCompare}
        </p>
        <div className="grid grid-cols-4 gap-3 mt-5 wr-rise" style={at(360, 8)}>
          {[
            [`${n.races}/${card.totalRounds}`, 'Rounds'],
            [fmt(n.laps), 'Race laps'],
            [`${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`, 'On track'],
            [fmt(n.practiceLaps), 'Practice'],
          ].map(([v, l]) => (
            <div key={l} className="wr-cell">
              <b>{v}</b>
              <small>{l}</small>
            </div>
          ))}
        </div>
      </>
    );
  }

  if (index === 1) {
    const nm = card.nemesis;
    if (!nm)
      return (
        <>
          {kicker('Your nemesis')}
          <p className="wr-support mt-auto">Nobody finished next to you twice. A lone wolf.</p>
        </>
      );
    return (
      <>
        {kicker('Your nemesis')}
        <div className="flex-1 flex items-center wr-fade" style={at(80)}>
          <div className="w-full">
            <RivalryChart rivalry={card.rivalry} them={nm.name} />
          </div>
        </div>
        <div className="wr-hero wr-rise" style={at(160, 28)}>
          {nm.name}
          {nm.number != null && <small> #{nm.number}</small>}
        </div>
        <p className="wr-support wr-rise mt-2" style={at(280, 10)}>
          You finished side by side {nm.sideBySide} {nm.sideBySide === 1 ? 'time' : 'times'}.
        </p>
        <div className="grid grid-cols-2 gap-3 mt-5 wr-rise" style={at(360, 8)}>
          <div className="wr-cell">
            <b>{nm.ahead}</b>
            <small>Times you were ahead</small>
          </div>
          <div className="wr-cell">
            <b>{nm.behind}</b>
            <small>Times they were ahead</small>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {kicker('Your Season 19 was')}
      <div className="flex-1 flex items-center">
        <div className="w-full">
          <FieldPlot field={card.field} />
        </div>
      </div>
      <div className="wr-hero wr-rise" style={at(160, 28)}>
        {card.archetype.title}
      </div>
      <p className="wr-support wr-rise mt-2" style={at(280, 10)}>
        {card.archetype.line}
      </p>
      <div className="mt-5 wr-rise" style={at(360, 8)}>
        <div className="wr-cell">
          <small className="!mt-0 mb-1">The number behind it</small>
          <b className="!text-[17px] !leading-snug !not-italic !font-sans !font-semibold">{card.archetypeEvidence}</b>
        </div>
      </div>
    </>
  );
}

export function WrappedPrototype({ card, roster }: { card: WrappedDriverCard; roster: WrappedRosterEntry[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const reduced = useReducedMotion();
  const [slide, setSlide] = useState(0);
  // Forward plays the build-up; going back shows the slide settled.
  const [forward, setForward] = useState(true);

  const go = useCallback((delta: number) => {
    setSlide((s) => {
      const next = Math.min(SLIDES - 1, Math.max(0, s + delta));
      if (next !== s) setForward(delta > 0);
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('select, input')) return;
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  // New driver: restart from the first slide.
  useEffect(() => {
    setSlide(0);
    setForward(true);
  }, [card.steamId]);

  const pickDriver = (steamId: string) => {
    const q = new URLSearchParams(params.toString());
    q.set('d', steamId);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  const divisions = [...new Set(roster.map((r) => r.division))];
  const animate = forward && !reduced;

  return (
    <div className="flex flex-col lg:flex-row gap-10 items-start">
      <aside className="w-full lg:w-[300px] shrink-0 flex flex-col gap-6">
        <div>
          <label htmlFor="wr-driver" className="block font-mono text-[11px] tracking-[.25em] uppercase text-txt-3 mb-3">
            Driver
          </label>
          <select
            id="wr-driver"
            value={card.steamId}
            onChange={(e) => pickDriver(e.target.value)}
            className="w-full bg-panel-2 text-txt border border-line px-3 py-2.5 font-mono text-[13px] focus:outline-none focus:border-gold"
          >
            {divisions.map((div) => (
              <optgroup key={div} label={`Division ${div}`}>
                {roster
                  .filter((r) => r.division === div)
                  .map((r) => (
                    <option key={r.steamId} value={r.steamId}>
                      {r.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>
        <p className="font-sans text-[13px] text-txt-3 leading-relaxed">
          Tap the right or left side of the card, or use ← →. Prototype: 3 of the planned 12 slides, live S19
          data, admins only. Style: broadcast type, editorial restraint; gold marks only your own data.
        </p>
      </aside>

      <div className="w-full flex justify-center">
        <div className="wr-frame">
          <div
            key={`${card.steamId}-${slide}`}
            className={`absolute inset-0 flex flex-col p-6 pt-5 ${animate ? '' : 'wr-instant'}`}
            style={{ containerType: 'inline-size' }}
          >
            <div className="wr-progress" aria-hidden="true">
              {Array.from({ length: SLIDES }, (_, i) => (
                <span key={i} data-on={i <= slide} />
              ))}
            </div>
            <div className="flex justify-between items-baseline mt-3 mb-6 font-mono text-[10px] tracking-[.2em] uppercase text-txt-3">
              <span>SRA · S19 Wrapped</span>
              <span>
                Div {card.division} · {card.name}
                {card.number != null ? ` #${card.number}` : ''}
              </span>
            </div>
            <div className="flex-1 flex flex-col min-h-0" aria-live="polite">
              <Slide card={card} index={slide} animate={animate} />
            </div>
          </div>
          <button
            type="button"
            aria-label="Previous slide"
            disabled={slide === 0}
            onClick={() => go(-1)}
            className="absolute inset-y-0 left-0 w-1/3 z-10 cursor-w-resize disabled:cursor-default"
          />
          <button
            type="button"
            aria-label="Next slide"
            disabled={slide === SLIDES - 1}
            onClick={() => go(1)}
            className="absolute inset-y-0 right-0 w-2/3 z-10 cursor-e-resize disabled:cursor-default"
          />
        </div>
      </div>
    </div>
  );
}
