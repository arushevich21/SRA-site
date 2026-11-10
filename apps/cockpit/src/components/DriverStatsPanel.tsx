import Link from 'next/link';
import { msToLaptime } from '@sra/domain';
import type { CarLaps, DriverStats } from '@/lib/driver-stats';
import type { DriverTier } from '@/lib/driver-tier-badge';
import { CarLogo } from './CarLogo';
import { SRatingTrend } from './SRatingTrend';

// The driver's current classification (drivers.division_id / tier /
// is_sralien) — shown in Racing Record.
export type DriverStanding = { division: number | null; tier: DriverTier | null; isSralien: boolean };

const HOT_LAPS_SHOWN = 5;
const HOT_LAPS_MAX = 15;

// Driver stats blocks — shared by /profile (your own) and /drivers/[id]
// (public). Server component; only the trend sparkline hydrates. Each block
// renders only when its source has data for this driver (empty ≠ zero), and
// rollup-backed blocks say when they were computed.

const nf = new Intl.NumberFormat('en-US');

function monthYear(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'America/New_York' });
}

function pct(v: number | null, digits = 1): string {
  return v == null ? '—' : `${(v * 100).toFixed(digits)}%`;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function Block({
  title,
  context,
  note,
  children,
}: {
  title: string;
  context?: string; // which data the block covers, e.g. "GT3 Series"
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-line bg-panel px-7 py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-5">
        <p className="font-mono text-[11px] tracking-[.35em] uppercase text-gold">
          {title}
          {context && <span className="text-txt-3 ml-3 tracking-[.2em]">{context}</span>}
        </p>
        {note && <p className="font-mono text-[10px] tracking-[.15em] uppercase text-txt-3">{note}</p>}
      </div>
      {children}
    </div>
  );
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <span className="block font-display text-[36px] text-gold leading-none">{value}</span>
      <span className="block font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 mt-2">{label}</span>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-line last:border-b-0">
      <span className="font-mono text-[11px] tracking-[.15em] uppercase text-txt-3">{label}</span>
      <span className="font-sans text-[14px] text-txt text-right">{value}</span>
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div className="flex items-center justify-between font-mono text-[11px] uppercase text-txt-3 mb-1">
        <span>{label}</span>
        <span className="text-txt-2">{pct(value)}</span>
      </div>
      <div className="h-1.5 bg-line/40 overflow-hidden">
        <div className="h-full bg-gold" style={{ width: `${Math.max(0, Math.min(100, (value ?? 0) * 100))}%` }} />
      </div>
    </div>
  );
}

// Where a driver's races end up, as one bar: wins ⊂ podiums ⊂ top 10s ⊂
// starts, so each band is the increment over the one before it.
function FinishProfile({ starts, wins, podiums, top10s }: { starts: number; wins: number; podiums: number; top10s: number }) {
  if (starts === 0) return null;
  const bands = [
    { label: 'Wins', n: wins, cls: 'bg-gold' },
    { label: 'Podiums', n: podiums - wins, cls: 'bg-gold-soft/60' },
    { label: 'Top 10s', n: top10s - podiums, cls: 'bg-gold-deep/45' },
    { label: 'Other', n: starts - top10s, cls: 'bg-line' },
  ];
  return (
    <div>
      <div className="flex h-3 overflow-hidden gap-px" role="img" aria-label={bands.map((b) => `${b.label} ${b.n}`).join(', ')}>
        {bands.map((b) =>
          b.n > 0 ? <div key={b.label} className={b.cls} style={{ width: `${(b.n / starts) * 100}%`, minWidth: 3 }} /> : null,
        )}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 font-sans text-[12px] text-txt-3">
        {[
          { label: 'Win', value: wins / starts, cls: 'bg-gold' },
          { label: 'Podium', value: podiums / starts, cls: 'bg-gold-soft/60' },
          { label: 'Top 10', value: top10s / starts, cls: 'bg-gold-deep/45' },
        ].map((r) => (
          <span key={r.label} className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 ${r.cls}`} />
            {r.label} rate <span className="text-txt">{pct(r.value)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// Small secondary figure: value over a quiet caption, no box.
function Mini({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <span className="block font-display text-[22px] text-txt leading-none">{value}</span>
      <span className="block font-sans text-[12px] text-txt-3 mt-1.5">{label}</span>
    </div>
  );
}

type HotLap = DriverStats['placings'][number];

function HotLapRow({ p }: { p: HotLap }) {
  return (
    <tr className="border-t border-line group">
      <td className={`py-2.5 font-display text-[18px] w-14 ${p.position <= 3 ? 'text-gold' : 'text-txt'}`}>
        P{p.position}
      </td>
      <td className="py-2.5 font-sans text-[14px] text-txt">
        <Link href={p.href} className="group-hover:text-gold underline-offset-4 group-hover:underline">
          {p.track}
        </Link>
        <span className="block font-sans text-[12px] text-txt-3 mt-0.5">
          {p.season} / {p.car ?? p.carClass}
          {p.isWet ? ' / Wet' : ''} / {nf.format(p.boardSize)} drivers
        </span>
      </td>
      <td className="py-2.5 text-right font-mono text-[13px] text-txt-2 tabular-nums">
        <Link href={p.href} className="group-hover:text-gold">
          {msToLaptime(p.bestLapMs)}
        </Link>
      </td>
    </tr>
  );
}

function finishTone(position: number): string {
  if (position === 1) return 'bg-gold text-carbon border-gold';
  if (position <= 3) return 'border-gold text-gold';
  if (position <= 10) return 'border-line-2 text-txt';
  return 'border-line text-txt-2';
}

const CARS_SHOWN = 5;

// A car with a handful of laps shouldn't read as "0%".
function sharePct(share: number): string {
  const p = Math.round(share * 100);
  return p === 0 && share > 0 ? '<1%' : `${p}%`;
}

function CarRow({ car }: { car: CarLaps }) {
  return (
    <li className="py-2">
      <div className="flex items-center justify-between gap-4 mb-1">
        <span className="flex items-center gap-2 min-w-0">
          {/* Fixed slot so names line up whether or not a badge exists. */}
          <span className="w-4 flex justify-center shrink-0">
            <CarLogo {...car.logo} alt="" size={16} />
          </span>
          <span className="font-sans text-[14px] text-txt min-w-0">{car.name}</span>
        </span>
        <span className="font-mono text-[12px] text-txt-2 whitespace-nowrap">
          {nf.format(car.laps)} <span className="text-txt-3 ml-1">{sharePct(car.share)}</span>
        </span>
      </div>
      <div className="h-1.5 bg-line/40 overflow-hidden">
        <div className="h-full bg-gold" style={{ width: `${Math.max(1, car.share * 100)}%` }} />
      </div>
    </li>
  );
}

// Every car the driver has laps in, most first. The rest sit behind a native
// <details> toggle — no client JS.
function LapsByCar({ cars }: { cars: CarLaps[] }) {
  const rest = cars.slice(CARS_SHOWN);
  return (
    <div className="mt-6">
      <p className="font-mono text-[11px] tracking-[.15em] uppercase text-txt-3 mb-2">Laps by car</p>
      <ul>
        {cars.slice(0, CARS_SHOWN).map((c) => (
          <CarRow key={c.name} car={c} />
        ))}
      </ul>
      {rest.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 hover:text-gold py-2">
            <span className="group-open:hidden">▸ Show all {cars.length} cars</span>
            <span className="hidden group-open:inline">▾ Show fewer</span>
          </summary>
          <ul>
            {rest.map((c) => (
              <CarRow key={c.name} car={c} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function standingLabel({ division, tier, isSralien }: DriverStanding): string | null {
  const parts = [
    division != null ? `Division ${division}` : null,
    tier ? (tier === 'gold' ? 'Gold' : 'Silver') : null,
    isSralien ? 'SRAlien' : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

export function DriverStatsPanel({
  stats,
  possessive = 'Their',
}: {
  stats: DriverStats;
  possessive?: string;
}) {
  const { record, rating, trend, recent, mileage, placings } = stats;
  const nothing = !record && !rating && recent.length === 0 && !mileage && placings.length === 0;

  if (nothing) {
    return (
      <div className="border border-line bg-panel px-7 py-6">
        <p className="font-sans text-[14px] text-txt-2">
          No race results, rating or lap data yet. Stats appear here once results are recorded under this
          driver&apos;s Steam account.
        </p>
      </div>
    );
  }

  const top10Boards = placings.filter((p) => p.position <= 10).length;
  const wins = placings.filter((p) => p.position === 1).length;

  // Each block is built only when it has data. Blocks are split into two
  // independent column stacks (not a row-paired grid) so a short block never
  // stretches to match its neighbour. Weights are rough heights in rows;
  // each block goes to the shorter column, keeping reading order within each.
  const blocks: Array<{ key: string; weight: number; node: React.ReactNode }> = [];

  if (record) {
    blocks.push({
      key: 'record',
      weight: 8,
      node: (
        <Block title="Racing Record" context="GT3 Series">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-7">
            <Tile value={nf.format(record.starts)} label="Starts" />
            <Tile value={nf.format(record.wins)} label="Wins" />
            <Tile value={nf.format(record.podiums)} label="Podiums" />
            <Tile value={nf.format(record.top10s)} label="Top 10s" />
          </div>
          <FinishProfile starts={record.starts} wins={record.wins} podiums={record.podiums} top10s={record.top10s} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-7 pt-6 border-t border-line">
            <Mini value={record.bestFinish ? ordinal(record.bestFinish) : '—'} label="Best finish" />
            <Mini value={record.avgFinish != null ? record.avgFinish.toFixed(1) : '—'} label="Average finish" />
            <Mini value={String(record.seasons)} label="Seasons" />
            {record.firstRace && <Mini value={monthYear(record.firstRace)} label="First race" />}
          </div>
        </Block>
      ),
    });
  }

  if (rating) {
    blocks.push({
      key: 'rating',
      weight: 9,
      node: (
        <Block title="SRAting">
          <div className="flex items-baseline gap-3 mb-5">
            <span className="font-display font-black text-[40px] leading-none text-gold">{pct(rating.composite)}</span>
            {rating.rank != null && (
              <span className="font-mono text-[13px] text-txt-3">
                Rank #{rating.rank}
                {rating.rankedOf != null && <span className="text-txt-3/70"> of {nf.format(rating.rankedOf)}</span>}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-3 mb-6">
            <Bar label="Pace" value={rating.pacePct} />
            <Bar label="Racecraft" value={rating.osPct} />
            <Bar label="Consistency" value={rating.consPct} />
          </div>
          <SRatingTrend points={trend} />
        </Block>
      ),
    });
  }

  if (recent.length > 0) {
    blocks.push({
      key: 'recent',
      weight: 4,
      node: (
        <Block title="Recent Results" context="GT3 Series">
          {/* Newest first, one card per race: the finish is the headline. */}
          <ol className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {recent.map((r) => {
              const card = (
                <>
                  <span className={`flex items-center justify-center h-14 border font-display text-[24px] leading-none ${finishTone(r.position)} group-hover:border-gold-soft transition-colors`}>
                    P{r.position}
                  </span>
                  <span className="block font-sans text-[12px] text-txt-2 mt-2 leading-tight truncate">{r.track}</span>
                  <span className="block font-mono text-[10px] text-txt-3 mt-0.5">
                    S{r.season} R{r.round}
                    {r.note ? ` ${r.note}` : ''}
                  </span>
                </>
              );
              return (
                <li key={`${r.season}-${r.round}`} className="min-w-0">
                  {r.href ? (
                    <Link href={r.href} className="block group" title={`${r.track}, S${r.season} R${r.round}`}>
                      {card}
                    </Link>
                  ) : (
                    card
                  )}
                </li>
              );
            })}
          </ol>
        </Block>
      ),
    });
  }

  if (mileage) {
    blocks.push({
      key: 'mileage',
      weight: 8 + Math.min(mileage.cars.length, CARS_SHOWN),
      node: (
        <Block
          title="Mileage"
          context="All ACC servers"
          note={mileage.firstSeen ? `on track since ${monthYear(mileage.firstSeen)}` : undefined}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-6">
            <Tile value={nf.format(mileage.laps)} label="Laps" />
            <Tile value={`#${nf.format(mileage.lapsRank)}`} label="All-time" />
            <Tile value={nf.format(mileage.sessions)} label="Sessions" />
            <Tile value={pct(mileage.laps ? mileage.validLaps / mileage.laps : null, 0)} label="Valid" />
          </div>
          {mileage.topTrack && (
            <Fact
              label="Most-driven track"
              value={`${mileage.topTrack}, ${nf.format(mileage.topTrackLaps ?? 0)} laps`}
            />
          )}
          {mileage.cars.length === 0 && mileage.topCar && (
            <Fact label="Most-driven car" value={`${mileage.topCar}, ${nf.format(mileage.topCarLaps ?? 0)} laps`} />
          )}
          {mileage.cars.length > 0 && <LapsByCar cars={mileage.cars} />}
        </Block>
      ),
    });
  }

  if (placings.length > 0) {
    const shown = placings.slice(0, HOT_LAPS_SHOWN);
    const more = placings.slice(HOT_LAPS_SHOWN, HOT_LAPS_MAX);
    blocks.push({
      key: 'placings',
      weight: 3 + shown.length * 1.2,
      node: (
        <Block title="Top Hot Laps" context="Seasonal boards">
          <p className="font-sans text-[14px] text-txt-2 mb-4">
            {possessive} laps are on {placings.length} seasonal board{placings.length === 1 ? '' : 's'}
            {wins > 0 ? (
              <>
                {', '}
                <span className="text-gold">fastest on {wins}</span>
                {top10Boards > wins && <>, top 10 on {top10Boards}</>}
              </>
            ) : (
              top10Boards > 0 && (
                <>
                  {', '}
                  <span className="text-gold">top 10 on {top10Boards}</span>
                </>
              )
            )}
            .
          </p>
          <table className="w-full text-left">
            <tbody>
              {shown.map((p) => (
                <HotLapRow key={`${p.season}-${p.track}`} p={p} />
              ))}
            </tbody>
          </table>
          {more.length > 0 && (
            // Named group: the rows are `group`s too, and an unnamed one here
            // would light up every row's hover style at once.
            <details className="group/more">
              <summary className="cursor-pointer list-none font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 hover:text-gold pt-3">
                <span className="group-open/more:hidden">▸ Show {more.length} more</span>
                <span className="hidden group-open/more:inline">▾ Show fewer</span>
              </summary>
              <table className="w-full text-left">
                <tbody>
                  {more.map((p) => (
                    <HotLapRow key={`${p.season}-${p.track}`} p={p} />
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </Block>
      ),
    });
  }

  const columns: [typeof blocks, typeof blocks] = [[], []];
  const height = [0, 0];
  for (const b of blocks) {
    const col = height[0] <= height[1] ? 0 : 1;
    columns[col].push(b);
    height[col] += b.weight;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {columns.map((col, i) =>
        col.length > 0 ? (
          <div key={i} className="flex flex-col gap-6">
            {col.map((b) => (
              <div key={b.key}>{b.node}</div>
            ))}
          </div>
        ) : null,
      )}
    </div>
  );
}
