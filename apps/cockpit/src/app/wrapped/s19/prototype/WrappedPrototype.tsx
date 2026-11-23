'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { WrappedDriverCard, WrappedRosterEntry } from '@/lib/wrapped/s19-prototype';
import './wrapped.css';

export type Direction = 'a' | 'b' | 'c';
const DIRECTIONS: { key: Direction; name: string; note: string }[] = [
  { key: 'a', name: 'Broadcast', note: 'TV graphics package: skewed plates, ACC red, italic condensed type' },
  { key: 'b', name: 'Editorial', note: 'Magazine spread: huge numerals, hairline rules, gold used once' },
  { key: 'c', name: 'Telemetry', note: 'Timing screen: grid, monospace readouts, purple-sector accents' },
];
const SLIDES = 3;

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
      const p = Math.min((t - start - 60) / 900, 1);
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

function Kicker({ children }: { children: ReactNode }) {
  return (
    <div className="wr-fade" style={at(0)}>
      <span className="wr-kicker">
        <span>{children}</span>
      </span>
    </div>
  );
}

function Slide({ card, index, animate }: { card: WrappedDriverCard; index: number; animate: boolean }) {
  const n = card.numbers;
  if (index === 0)
    return (
      <>
        <Kicker>Season 19 in numbers</Kicker>
        <div className="mt-auto">
          <div className="wr-hero wr-rise" style={at(60, 28)}>
            <CountUp value={n.km} run={animate} />
            <em> km</em>
          </div>
          <p className="wr-support wr-rise mt-4" style={at(200, 10)}>
            {card.distanceCompare}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 mt-8 wr-rise" style={at(290, 8)}>
          {[
            [`${n.races}/${card.totalRounds}`, 'Rounds raced', '#e6b53d'],
            [fmt(n.laps), 'Race laps', '#b14eff'],
            [`${Math.floor(Math.round(n.hours * 60) / 60)}h ${Math.round(n.hours * 60) % 60}m`, 'On track', '#36e0c8'],
            [fmt(n.practiceLaps), `Practice laps · top ${Math.max(1, Math.round((1 - card.practicePct) * 100))}%`, '#e04040'],
          ].map(([v, l, bar]) => (
            <div key={l} className="wr-cell" style={{ '--bar': bar } as CSSProperties}>
              <b>{v}</b>
              <small>{l}</small>
            </div>
          ))}
        </div>
      </>
    );

  if (index === 1) {
    const nm = card.nemesis;
    if (!nm)
      return (
        <>
          <Kicker>Your nemesis</Kicker>
          <p className="wr-support mt-auto">Nobody finished next to you twice. A lone wolf.</p>
        </>
      );
    const [first, ...rest] = nm.name.split(' ');
    return (
      <>
        <Kicker>Your nemesis</Kicker>
        <div className="mt-auto">
          <div className="wr-hero wr-rise" style={at(60, 28)}>
            {first}
            <br />
            <em>{rest.join(' ') || ' '}</em>
          </div>
          {nm.number != null && (
            <div className="mt-4 wr-fade" style={at(60)}>
              <span className="wr-plate">
                <span>#{nm.number}</span>
              </span>
            </div>
          )}
          <p className="wr-support wr-rise mt-5" style={at(200, 10)}>
            You finished side by side {nm.sideBySide} times.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-8 wr-rise" style={at(290, 8)}>
          <div className="wr-cell" style={{ '--bar': '#36e0c8' } as CSSProperties}>
            <b>{nm.ahead}</b>
            <small>Times you were ahead</small>
          </div>
          <div className="wr-cell" style={{ '--bar': '#e04040' } as CSSProperties}>
            <b>{nm.behind}</b>
            <small>Times they were ahead</small>
          </div>
        </div>
      </>
    );
  }

  const [lead, ...tail] = card.archetype.title.split(' ');
  return (
    <>
      <Kicker>Your Season 19 was</Kicker>
      <div className="mt-auto">
        <div className="wr-hero wr-rise" style={at(60, 28)}>
          {lead}
          <br />
          <em>{tail.join(' ')}</em>
        </div>
        <p className="wr-support wr-rise mt-5" style={at(200, 10)}>
          {card.archetype.line}
        </p>
      </div>
      <div className="mt-8 wr-rise" style={at(290, 8)}>
        <div className="wr-cell" style={{ '--bar': '#b14eff' } as CSSProperties}>
          <small>The number behind it</small>
          <b className="!text-[17px] !leading-snug mt-1">{card.archetypeEvidence}</b>
        </div>
      </div>
    </>
  );
}

export function WrappedPrototype({
  card,
  roster,
  direction,
}: {
  card: WrappedDriverCard;
  roster: WrappedRosterEntry[];
  direction: Direction;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const reduced = useReducedMotion();
  const [slide, setSlide] = useState(0);
  // Forward plays the build-up; going back shows the slide settled.
  const [forward, setForward] = useState(true);
  const frameRef = useRef<HTMLDivElement>(null);

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

  // New driver or direction: restart from the first slide.
  useEffect(() => {
    setSlide(0);
    setForward(true);
  }, [card.steamId, direction]);

  const setParam = (key: string, value: string) => {
    const q = new URLSearchParams(params.toString());
    q.set(key, value);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  const divisions = [...new Set(roster.map((r) => r.division))];
  const animate = forward && !reduced;

  return (
    <div className="flex flex-col lg:flex-row gap-10 items-start">
      <aside className="w-full lg:w-[300px] shrink-0 flex flex-col gap-6">
        <div>
          <p className="font-mono text-[11px] tracking-[.25em] uppercase text-txt-3 mb-3">Design direction</p>
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Design direction">
            {DIRECTIONS.map((d) => (
              <button
                key={d.key}
                type="button"
                role="radio"
                aria-checked={d.key === direction}
                onClick={() => setParam('v', d.key)}
                className={`text-left border px-4 py-3 transition-colors ${
                  d.key === direction ? 'border-gold bg-gold/5' : 'border-line hover:border-line-2'
                }`}
              >
                <span className="block font-display font-bold uppercase tracking-[.06em] text-[16px] text-txt">
                  {d.key.toUpperCase()} · {d.name}
                </span>
                <span className="block font-sans text-[12.5px] text-txt-3 mt-0.5">{d.note}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="wr-driver" className="block font-mono text-[11px] tracking-[.25em] uppercase text-txt-3 mb-3">
            Driver
          </label>
          <select
            id="wr-driver"
            value={card.steamId}
            onChange={(e) => setParam('d', e.target.value)}
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
          Tap the right or left half of the card, or use ← →. Prototype: 3 of the planned 12 slides, live S19 data,
          admins only.
        </p>
      </aside>

      <div className="w-full flex justify-center" style={{ containerType: 'inline-size' }}>
        <div ref={frameRef} className={`wr-frame wr-${direction}`}>
          <div
            key={`${direction}-${card.steamId}-${slide}`}
            className={`absolute inset-0 flex flex-col p-6 pt-5 ${animate ? '' : 'wr-instant'}`}
            style={{ containerType: 'inline-size' }}
          >
            <div className="wr-progress" aria-hidden="true">
              {Array.from({ length: SLIDES }, (_, i) => (
                <span key={i} data-on={i <= slide} />
              ))}
            </div>
            <div className="flex justify-between items-baseline mt-3 mb-8 font-mono text-[10px] tracking-[.2em] uppercase text-txt-3">
              <span>SRA · S19 Wrapped</span>
              <span>
                Div {card.division} · {card.name}
                {card.number != null ? ` #${card.number}` : ''}
              </span>
            </div>
            <div className="flex-1 flex flex-col" aria-live="polite">
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
