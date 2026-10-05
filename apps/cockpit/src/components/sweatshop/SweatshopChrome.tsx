import Link from 'next/link';
import type { ReactNode } from 'react';
import type { SimConfig } from '@/content/sims';
import { GameLabel } from '@/components/GameLabel';
import { LeaderboardTabs } from '@/components/LeaderboardTabs';
import { SeasonSelect } from '@/components/SeasonSelect';
import type { AccLeaderboardShell } from '@/lib/acc/leaderboard-shell';
import type { SweatshopLeader, SweatshopTrackCard } from '@/lib/acc/sweatshop';
import { pickQuip } from '@/content/sweatshop-quips';

const SWEAT = '#5ec8f2';

export function sweatshopBasePath(simSlug: string) {
  return `/${simSlug}/leaderboards/sweatshop`;
}

function seasonLabel(season: string) {
  const m = season.match(/^S(\d+)$/i);
  return m ? `Season ${m[1]}` : season;
}

function fmt(n: number) {
  return n.toLocaleString('en-US');
}

// Page frame shared by both Sweatshop views: heading, board tabs, the
// Season Total / By Track toggle and the season picker.
export function SweatshopShell({
  sim,
  shell,
  season,
  view,
  byTrackHref,
  children,
}: {
  sim: SimConfig;
  shell: AccLeaderboardShell;
  season: string;
  view: 'season' | 'track';
  byTrackHref: string | null;
  children: ReactNode;
}) {
  const base = sweatshopBasePath(sim.slug);
  const toggle = (active: boolean) =>
    [
      'font-mono text-[13px] tracking-[.15em] uppercase px-3 py-1.5 border transition-colors',
      active
        ? 'border-[var(--sim-accent)] text-[var(--sim-accent)]'
        : 'border-line/50 text-txt-3 hover:text-txt hover:border-line',
    ].join(' ');

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase mb-5" style={{ color: 'var(--sim-accent)' }}>
        — <GameLabel game={sim.game} /> Leaderboards
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-16">
        Leaderboards
      </h1>

      <LeaderboardTabs
        simSlug={sim.slug}
        showSeasonal={shell.seasons.length > 0}
        showEndurance={shell.showEndurance}
        showHotStintQualifying={shell.showHotStintQualifying}
        showJagoff={shell.showJagoff}
      />

      <div className="flex flex-wrap items-center gap-2 mb-7">
        <Link href={`${base}/${season}`} className={toggle(view === 'season')}>
          Season Total
        </Link>
        {byTrackHref ? (
          <Link href={byTrackHref} className={toggle(view === 'track')}>
            By Track
          </Link>
        ) : (
          <span className={`${toggle(false)} opacity-40 cursor-not-allowed`}>By Track</span>
        )}
        <span className="ml-auto">
          <SeasonSelect seasons={shell.seasons} selected={season} basePath={base} />
        </span>
      </div>

      {children}
    </section>
  );
}

// View A's headline: the season's sweatiest hotlapper, full width.
export function SweatshopHero({ leader, season }: { leader: SweatshopLeader; season: string }) {
  const { driver, validPct, tier } = leader;
  const roasted = tier === 'sloppy' || tier === 'wild' || tier === 'feral';
  const hours = Math.floor(driver.approxSecondsLapping / 3600);
  return (
    <div className="relative overflow-hidden border border-line bg-carbon-2 px-6 py-7 sm:px-8 mb-8 grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-4 -top-10 text-[190px] leading-none opacity-[.07] rotate-[14deg] select-none"
      >
        💦
      </span>
      <div className="min-w-0">
        <p className="font-mono text-[13px] tracking-[.3em] uppercase mb-3.5" style={{ color: SWEAT }}>
          💦 Sweatiest hotlapper · {seasonLabel(season)}
        </p>
        <p className="font-display font-black uppercase text-[clamp(40px,6.4vw,76px)] leading-[.88] tracking-[-1px] text-txt text-balance">
          {driver.driverNumber != null && (
            <span className="font-semibold text-txt-3 text-[.45em] tracking-normal align-[.9em] mr-2.5">
              #{driver.driverNumber}
            </span>
          )}
          {driver.name}
        </p>
        <p className="font-display font-semibold uppercase text-[clamp(20px,2.4vw,28px)] leading-[1.15] text-txt-2 mt-2.5">
          {pickQuip(tier, 'season', `${driver.steamId}:${season}`, { pct: validPct })}
        </p>
      </div>
      <div className="flex flex-wrap gap-7">
        <HeroStat value={fmt(driver.laps)} label="Laps" />
        <HeroStat value={`${validPct ?? 0}%`} label="Valid" warn={roasted} />
        <HeroStat
          value={`${hours}h+`}
          label="Lapping"
          title="Laps × best lap time, so a floor: real laps are slower."
        />
      </div>
    </div>
  );
}

function HeroStat({ value, label, warn, title }: { value: string; label: string; warn?: boolean; title?: string }) {
  return (
    <div title={title}>
      <div
        className="font-display font-bold text-[40px] leading-none tabular-nums"
        style={{ color: warn ? 'var(--sim-accent)' : 'var(--color-gold)' }}
      >
        {value}
      </div>
      <div className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 mt-1.5">{label}</div>
    </div>
  );
}

// View C's week picker: one card per calendar round (or per track, for a
// season with no calendar).
export function SweatshopTrackCards({
  cards,
  activeKey,
  hrefFor,
}: {
  cards: SweatshopTrackCard[];
  activeKey: string;
  hrefFor: (trackKey: string) => string;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 mb-6">
      {cards.map((c) => {
        const viewable = c.released && c.laps > 0;
        const active = c.trackKey === activeKey;
        const body = (
          <>
            <span className="flex justify-between gap-1.5 font-mono text-[11px] tracking-[.2em] uppercase text-inherit">
              <span>{c.round != null ? `Week ${c.round}` : 'Track'}</span>
              {c.current && <span style={{ color: 'var(--sim-accent)' }}>● Live</span>}
            </span>
            <span className={`font-display font-bold text-[17px] leading-[1.1] uppercase ${active ? 'text-txt' : 'text-txt-2'}`}>
              {c.displayName}
            </span>
            <span className="font-mono text-[11px] tracking-[.05em] text-txt-3 truncate">
              {!c.released
                ? 'Not released'
                : c.leaderName
                  ? `💦 ${c.leaderName} · ${fmt(c.leaderLaps)}`
                  : 'No laps yet'}
            </span>
          </>
        );
        const cls = [
          'grid gap-1 border px-3 py-2.5 text-left min-w-0',
          active
            ? 'border-gold bg-[color-mix(in_srgb,var(--color-gold)_7%,var(--color-carbon-2))] text-gold'
            : 'border-line bg-carbon-2 text-txt-3',
          viewable && !active ? 'hover:border-line-2 transition-colors' : '',
          viewable ? '' : 'opacity-45',
        ].join(' ');
        return viewable ? (
          <Link key={c.trackKey} href={hrefFor(c.trackKey)} className={cls} aria-current={active ? 'page' : undefined}>
            {body}
          </Link>
        ) : (
          <div key={c.trackKey} className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

// View C's one-line callout above a track's board.
export function SweatshopTrackBanner({
  leader,
  trackName,
  season,
}: {
  leader: SweatshopLeader;
  trackName: string;
  season: string;
}) {
  const { driver, validPct, tier } = leader;
  return (
    <div
      className="flex flex-wrap items-center gap-x-3.5 gap-y-1 border px-4.5 py-3.5 mb-5"
      style={{
        borderColor: `color-mix(in srgb, ${SWEAT} 35%, var(--color-line))`,
        background: `color-mix(in srgb, ${SWEAT} 6%, var(--color-carbon-2))`,
      }}
    >
      <span aria-hidden className="text-[26px]">💦</span>
      <span className="font-display font-bold text-[22px] leading-[1.15] uppercase flex-1 min-w-0">
        <span style={{ color: SWEAT }}>{driver.name}</span>{' '}
        {pickQuip(tier, 'track', `${driver.steamId}:${season}:${trackName}`, { pct: validPct, track: trackName })}
      </span>
      <span className="font-mono text-[12px] tracking-[.15em] uppercase text-txt-3">
        {fmt(driver.laps)} laps · {validPct ?? 0}% valid
      </span>
    </div>
  );
}
