'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { WrappedDriverCard, WrappedRosterEntry } from '@/lib/wrapped/s19-prototype';
import './wrapped.css';

// Season 19 Wrapped — story prototype. Each slide is one idea on a full-bleed
// colour field; setup slides ask, reveal slides answer. Slides advance on a
// timer (the progress bar IS the timer: its animation ending moves on, so
// pausing the animation pauses the story). Tap right/left to skip, hold to
// pause, ← → and space on a keyboard.

const C = {
  gold: '#E6B53D',
  red: '#E04040',
  cobalt: '#2337C6',
  green: '#0D6B4C',
  white: '#FFFFFF',
  carbon: '#0A0B0E',
};

type SlideDef = { bg: string; fg: string; ms: number | null; render: () => ReactNode };

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const d = (ms: number): CSSProperties => ({ '--d': `${ms}ms` }) as CSSProperties;

// A line of display type revealed out of its own line box.
function Line({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <span className="wx-line">
      <span style={d(delay)}>{children}</span>
    </span>
  );
}

function CountUp({ to, run }: { to: number; run: boolean }) {
  const [v, setV] = useState(run ? 0 : to);
  useEffect(() => {
    if (!run) return setV(to);
    let raf = 0;
    let t0: number | null = null;
    const tick = (t: number) => {
      t0 ??= t;
      const p = Math.min((t - t0) / 1400, 1);
      setV(to * (1 - Math.pow(1 - p, 4)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, run]);
  return <>{fmt(v)}</>;
}

function buildSlides(card: WrappedDriverCard, motion: boolean): SlideDef[] {
  const n = card.numbers;
  const finishes = card.rounds.filter((r) => r.position != null);
  const best = finishes.length ? Math.min(...finishes.map((r) => r.position!)) : null;
  const bestRound = card.rounds.find((r) => r.position === best);
  const minutes = Math.round(n.hours * 60);
  const nm = card.nemesis;

  const slides: SlideDef[] = [
    {
      bg: C.gold,
      fg: C.carbon,
      ms: 4200,
      render: () => (
        <>
          <div className="wx-kerb wx-sweep" style={{ ...d(0), top: '26%' }} aria-hidden="true" />
          <div className="mt-auto">
            {card.number != null && (
              <div className="wx-in mb-6" style={{ ...d(250), fontSize: 64 }}>
                <span className="wx-panel">{card.number}</span>
              </div>
            )}
            <p className="wx-say">
              <Line delay={350}>{card.name},</Line>
              <Line delay={450}>your Season 19</Line>
              <Line delay={550}>is in.</Line>
            </p>
          </div>
        </>
      ),
    },
    {
      bg: C.red,
      fg: C.white,
      ms: 3200,
      render: () => (
        <p className="wx-say my-auto">
          <Line>You put in some</Line>
          <Line delay={100}>serious miles.</Line>
        </p>
      ),
    },
    {
      bg: C.cobalt,
      fg: C.white,
      ms: 6500,
      render: () => (
        <>
          <div className="wx-road" aria-hidden="true" />
          <div className="relative mt-[18%]">
            <div className="wx-big">
              <Line>
                <CountUp to={n.km} run={motion} />
              </Line>
            </div>
            <div className="wx-say mt-1">
              <Line delay={120}>kilometers</Line>
            </div>
            <p className="wx-body mt-6 wx-in" style={d(500)}>
              {card.distanceCompare} {fmt(n.laps)} race laps in {Math.floor(minutes / 60)} hours {minutes % 60}{' '}
              minutes.
            </p>
          </div>
        </>
      ),
    },
    {
      bg: C.white,
      fg: C.carbon,
      ms: 7500,
      render: () => (
        <>
          <p className="wx-say">
            <Line>Every round,</Line>
            <Line delay={100}>on the board.</Line>
          </p>
          <div className="grid grid-cols-4 gap-3 mt-8">
            {card.rounds.map((r, i) => {
              const tilt = ((i * 7) % 5) - 2;
              return (
                <div
                  key={r.round}
                  className="wx-board wx-drop"
                  data-best={r.position != null && r.position === best}
                  data-dns={r.position == null}
                  style={{ ...d(300 + i * 70), '--r': `${tilt}deg` } as CSSProperties}
                  aria-label={`${r.track}: ${r.position != null ? `P${r.position}` : 'did not start'}`}
                >
                  <b>{r.position != null ? `P${r.position}` : '—'}</b>
                  <small>{r.code}</small>
                </div>
              );
            })}
          </div>
          {bestRound && (
            <p className="wx-body mt-auto wx-in" style={d(1100)}>
              {best === 1 ? 'Best of all: ' : 'Your best: '}
              <strong>
                P{best} at {bestRound.track}
              </strong>
              {finishes.filter((r) => r.position === best).length > 1
                ? `, and you did it ${finishes.filter((r) => r.position === best).length} times.`
                : '.'}
            </p>
          )}
        </>
      ),
    },
  ];

  if (nm) {
    slides.push(
      {
        bg: C.green,
        fg: C.white,
        ms: 3200,
        render: () => (
          <p className="wx-say my-auto">
            <Line>One driver kept</Line>
            <Line delay={100}>turning up in</Line>
            <Line delay={200}>your mirrors.</Line>
          </p>
        ),
      },
      {
        bg: C.red,
        fg: C.white,
        ms: 7000,
        render: () => (
          <>
            <div className="flex justify-center mt-4 wx-in" style={d(0)}>
              <div className="wx-mirror">{nm.number != null ? nm.number : '?'}</div>
            </div>
            <div className="mt-auto">
              <div className="wx-name">
                {nm.name.split(' ').map((w, i) => (
                  <Line key={i} delay={250 + i * 100}>
                    {w}
                  </Line>
                ))}
              </div>
              <p className="wx-body mt-5 wx-in" style={d(650)}>
                Side by side at the flag {nm.sideBySide} {nm.sideBySide === 1 ? 'time' : 'times'}. Head to head, you
                finished ahead {nm.ahead} {nm.ahead === 1 ? 'time' : 'times'}, they did {nm.behind}.
              </p>
            </div>
          </>
        ),
      },
    );
  }

  slides.push(
    {
      bg: C.cobalt,
      fg: C.white,
      ms: 3000,
      render: () => (
        <p className="wx-say my-auto">
          <Line>So what kind of</Line>
          <Line delay={100}>driver were you?</Line>
        </p>
      ),
    },
    {
      bg: C.gold,
      fg: C.carbon,
      ms: 7000,
      render: () => (
        <>
          <div className="wx-kerb wx-sweep" style={{ ...d(0), bottom: '6%' }} aria-hidden="true" />
          <div className="mt-[22%]">
            <div className="wx-name">
              {card.archetype.title.split(' ').map((w, i) => (
                <Line key={i} delay={120 + i * 110}>
                  {w}
                </Line>
              ))}
            </div>
            <p className="wx-body mt-5 wx-in" style={d(550)}>
              {card.archetype.line}
            </p>
            <p className="wx-body mt-3 font-bold wx-in" style={d(700)}>
              {card.archetypeEvidence.replace(' — ', ': ')}.
            </p>
          </div>
        </>
      ),
    },
    {
      // Share card: a poster, not a profile. Gold hero (who + what kind of
      // driver), then two short lists side by side, then the headline
      // numbers and the sign-off.
      bg: C.gold,
      fg: C.carbon,
      ms: null, // the share card stays up
      render: () => {
        const topRounds = finishes
          .slice()
          .sort((a, b) => a.position! - b.position! || a.round - b.round)
          .slice(0, 3);
        return (
          <div className="wx-poster">
            <div className="wx-poster-hero">
              <div className="flex items-center gap-3 wx-in" style={d(0)}>
                {card.number != null && (
                  <span style={{ fontSize: 'clamp(26px, 9cqw, 40px)' }}>
                    <span className="wx-panel">{card.number}</span>
                  </span>
                )}
                <span className="wx-poster-name">{card.name}</span>
              </div>
              <div className="wx-name mt-auto">
                {card.archetype.title.split(' ').map((w, k) => (
                  <Line key={k} delay={120 + k * 90}>
                    {w}
                  </Line>
                ))}
              </div>
            </div>

            <div className="wx-poster-body">
              <div className="grid grid-cols-2 gap-5 wx-in" style={d(320)}>
                <section>
                  <h3 className="wx-poster-label">Best rounds</h3>
                  <ol className="flex flex-col gap-1.5">
                    {topRounds.map((r) => (
                      <li key={r.round} className="wx-poster-item">
                        <b>P{r.position}</b> {r.track}
                      </li>
                    ))}
                  </ol>
                </section>
                <section>
                  <h3 className="wx-poster-label">Nemesis</h3>
                  {nm ? (
                    <>
                      <p className="wx-poster-item">
                        <b>{nm.name}</b>
                      </p>
                      <p className="wx-poster-item mt-1.5">
                        You {nm.ahead}, them {nm.behind}
                      </p>
                    </>
                  ) : (
                    <p className="wx-poster-item">Nobody, really</p>
                  )}
                </section>
              </div>

              <div className="grid grid-cols-2 gap-5 mt-auto wx-in" style={d(420)}>
                <div>
                  <h3 className="wx-poster-label">Distance</h3>
                  <p className="wx-poster-stat">{fmt(n.km)} km</p>
                </div>
                <div>
                  <h3 className="wx-poster-label">Division {card.division}</h3>
                  <p className="wx-poster-stat">
                    {n.races} of {card.totalRounds} rounds
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-6 wx-in" style={d(500)}>
                {/* eslint-disable-next-line @next/next/no-img-element -- static brand lockup */}
                <img src="/badges/sra-lockup.webp" alt="Sim Racing Alliance" width={112} height={32} />
                <span className="text-[12px] text-white/55">Season 19 Wrapped</span>
              </div>
            </div>
          </div>
        );
      },
    },
  );
  return slides;
}

export function WrappedPrototype({ card, roster }: { card: WrappedDriverCard; roster: WrappedRosterEntry[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [reduced, setReduced] = useState(false);
  const [i, setI] = useState(0);
  const [held, setHeld] = useState(false);
  const [paused, setPaused] = useState(false);
  const [run, setRun] = useState(0); // remount key: replay / driver change
  const press = useRef<{ t: number; x: number } | null>(null);

  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(m.matches);
  }, []);

  const slides = buildSlides(card, !reduced);
  const slide = slides[i];
  const last = slides.length - 1;

  const go = useCallback((delta: number) => setI((s) => Math.min(last, Math.max(0, s + delta))), [last]);

  useEffect(() => {
    setI(0);
    setRun((r) => r + 1);
  }, [card.steamId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('select, input')) return;
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  // Tap = skip (left third back, rest forward). Hold = pause while held.
  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    press.current = { t: performance.now(), x: e.clientX };
    setHeld(true);
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    press.current = null;
    setHeld(false);
    if (!p || performance.now() - p.t > 250) return; // it was a hold
    const box = e.currentTarget.getBoundingClientRect();
    go(p.x - box.left < box.width / 3 ? -1 : 1);
  };

  const pickDriver = (steamId: string) => {
    const q = new URLSearchParams(params.toString());
    q.set('d', steamId);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };
  const divisions = [...new Set(roster.map((r) => r.division))];
  const frozen = held || paused;

  return (
    <div className="flex flex-col lg:flex-row gap-10 items-start">
      <aside className="w-full lg:w-[280px] shrink-0 flex flex-col gap-5">
        <div>
          <label htmlFor="wr-driver" className="block font-sans text-[13px] font-semibold text-txt-2 mb-2">
            Preview as
          </label>
          <select
            id="wr-driver"
            value={card.steamId}
            onChange={(e) => pickDriver(e.target.value)}
            className="w-full bg-panel-2 text-txt border border-line px-3 py-2.5 font-sans text-[14px] focus:outline-none focus:border-gold"
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
          Tap the right of the story to skip ahead, the left to go back. Hold to pause, or press space. Admins only;
          live Season 19 data.
        </p>
        <button
          type="button"
          onClick={() => {
            setI(0);
            setPaused(false);
            setRun((r) => r + 1);
          }}
          className="self-start font-sans text-[14px] font-semibold text-gold hover:text-gold-soft"
        >
          Replay from the start
        </button>
      </aside>

      <div className="w-full flex justify-center">
        <div
          className={`wx-stage ${frozen ? 'wx-held' : ''}`}
          style={{ background: slide.bg, color: slide.fg }}
          onPointerDown={onDown}
          onPointerUp={onUp}
          onPointerLeave={() => {
            press.current = null;
            setHeld(false);
          }}
          onContextMenu={(e) => e.preventDefault()}
          aria-roledescription="story"
        >
          <div className="wx-progress" aria-hidden="true">
            {slides.map((s, k) => (
              <span key={`${run}-${k}`} data-state={k < i ? 'done' : k === i ? 'now' : 'next'}>
                <i
                  style={{ '--dur': `${s.ms ?? 1}ms` } as CSSProperties}
                  onAnimationEnd={() => k === i && s.ms != null && go(1)}
                />
              </span>
            ))}
          </div>
          <button
            type="button"
            className="wx-pause"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? 'Play story' : 'Pause story'}
          >
            {paused ? (
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5v11l9-5.5z" fill="currentColor" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="2.5" y="1.5" width="3" height="11" fill="currentColor" /><rect x="8.5" y="1.5" width="3" height="11" fill="currentColor" /></svg>
            )}
          </button>
          <div key={`${run}-${i}`} className="wx-slide" aria-live="polite">
            {slide.render()}
          </div>
        </div>
      </div>
    </div>
  );
}
