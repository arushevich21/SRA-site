import Link from 'next/link';
import { msToLaptime } from '@sra/domain';
import type { DriverStats } from '@/lib/driver-stats';
import type { DriverTier } from '@/lib/driver-tier-badge';
import { DriverTierBadge } from './DriverTierBadge';
import { SRatingTrend } from './SRatingTrend';

// The driver's current classification (drivers.division_id / tier /
// is_sralien) — shown in Racing Record.
export type DriverStanding = { division: number | null; tier: DriverTier | null; isSralien: boolean };

const HOT_LAPS_SHOWN = 8;

// Driver stats blocks — shared by /profile (your own) and /drivers/[id]
// (public). Server component; only the trend sparkline hydrates. Each block
// renders only when its source has data for this driver (empty ≠ zero), and
// rollup-backed blocks say when they were computed.

const nf = new Intl.NumberFormat('en-US');

function asOf(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  });
}

function pct(v: number | null, digits = 1): string {
  return v == null ? '—' : `${(v * 100).toFixed(digits)}%`;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function Block({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="border border-line bg-panel px-7 py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-5">
        <p className="font-mono text-[11px] tracking-[.35em] uppercase text-gold">{title}</p>
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

function standingLabel({ division, tier, isSralien }: DriverStanding): string | null {
  const parts = [
    division != null ? `Division ${division}` : null,
    tier ? (tier === 'gold' ? 'Gold' : 'Silver') : null,
    isSralien ? 'SRAlien' : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

export function DriverStatsPanel({
  stats,
  standing,
  possessive = 'Their',
}: {
  stats: DriverStats;
  standing: DriverStanding;
  possessive?: string;
}) {
  const { record, rating, trend, recent, mileage, placings } = stats;
  const division = standingLabel(standing);
  const nothing = !record && !rating && recent.length === 0 && !mileage && placings.length === 0 && !division;

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {(record || division) && (
        <Block title="Racing Record · GT3 Series" note={record ? `as of ${asOf(record.computedAt)}` : undefined}>
          {division && (
            <div className="flex items-center justify-between gap-4 pb-4 mb-5 border-b border-line">
              <span className="font-mono text-[11px] tracking-[.15em] uppercase text-txt-3">Current division</span>
              <span className="flex items-center gap-3">
                <span className="font-sans text-[14px] text-txt">{division}</span>
                <DriverTierBadge {...standing} />
              </span>
            </div>
          )}
          {record ? (
            <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-6">
            <Tile value={nf.format(record.starts)} label="Starts" />
            <Tile value={nf.format(record.wins)} label="Wins" />
            <Tile value={nf.format(record.podiums)} label="Podiums" />
            <Tile value={nf.format(record.top10s)} label="Top 10s" />
          </div>
          <Fact label="Win rate" value={pct(record.starts ? record.wins / record.starts : null)} />
          <Fact label="Podium rate" value={pct(record.starts ? record.podiums / record.starts : null)} />
          <Fact label="Best finish" value={record.bestFinish ? ordinal(record.bestFinish) : '—'} />
          <Fact label="Average finish" value={record.avgFinish != null ? record.avgFinish.toFixed(1) : '—'} />
          <Fact label="Seasons raced" value={String(record.seasons)} />
          {record.firstRace && <Fact label="First race" value={asOf(record.firstRace)} />}
            </>
          ) : (
            <p className="font-sans text-[14px] text-txt-2">No GT3 Series races recorded yet.</p>
          )}
        </Block>
      )}

      {rating && (
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
      )}

      {recent.length > 0 && (
        <Block title="Recent Results · GT3 Series">
          <table className="w-full text-left">
            <thead>
              <tr className="font-mono text-[10px] tracking-[.15em] uppercase text-txt-3">
                <th className="font-normal pb-2">Round</th>
                <th className="font-normal pb-2">Track</th>
                <th className="font-normal pb-2 text-right">Finish</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={`${r.season}-${r.round}`} className="border-t border-line">
                  <td className="py-2 font-mono text-[13px] text-txt-2 whitespace-nowrap">
                    S{r.season} R{r.round}
                  </td>
                  <td className="py-2 font-sans text-[14px] text-txt">
                    {r.href ? (
                      <Link href={r.href} className="hover:text-gold underline-offset-4 hover:underline">
                        {r.track} →
                      </Link>
                    ) : (
                      r.track
                    )}
                    {r.note && (
                      <span className="ml-2 font-mono text-[10px] tracking-[.1em] uppercase text-txt-3">{r.note}</span>
                    )}
                  </td>
                  <td
                    className={`py-2 text-right font-display text-[18px] ${r.position <= 3 ? 'text-gold' : 'text-txt'}`}
                  >
                    P{r.position}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Block>
      )}

      {mileage && (
        <Block title="Mileage · All ACC Servers" note={`as of ${asOf(mileage.computedAt)}`}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 mb-6">
            <Tile value={nf.format(mileage.laps)} label="Laps" />
            <Tile value={pct(mileage.laps ? mileage.validLaps / mileage.laps : null, 0)} label="Valid" />
            <Tile value={nf.format(mileage.sessions)} label="Sessions" />
          </div>
          <Fact label="All-time laps rank" value={`#${nf.format(mileage.lapsRank)}`} />
          {mileage.topTrack && (
            <Fact
              label="Most-driven track"
              value={`${mileage.topTrack} · ${nf.format(mileage.topTrackLaps ?? 0)} laps`}
            />
          )}
          {mileage.topCar && (
            <Fact label="Most-driven car" value={`${mileage.topCar} · ${nf.format(mileage.topCarLaps ?? 0)} laps`} />
          )}
          {mileage.firstSeen && <Fact label="First seen on track" value={asOf(mileage.firstSeen)} />}
        </Block>
      )}

      {placings.length > 0 && (
        <Block title="Top Hot Laps · Seasonal Boards">
          <p className="font-sans text-[14px] text-txt-2 mb-4">
            {possessive} laps are on {placings.length} seasonal board{placings.length === 1 ? '' : 's'}
            {wins > 0 ? (
              <>
                {' '}
                — <span className="text-gold">fastest on {wins}</span>
                {top10Boards > wins && <>, top 10 on {top10Boards}</>}
              </>
            ) : (
              top10Boards > 0 && (
                <>
                  {' '}
                  — <span className="text-gold">top 10 on {top10Boards}</span>
                </>
              )
            )}
            .
          </p>
          <table className="w-full text-left">
            <tbody>
              {placings.slice(0, HOT_LAPS_SHOWN).map((p) => (
                <tr key={`${p.season}-${p.track}`} className="border-t border-line group">
                  <td className={`py-2 font-display text-[18px] w-14 ${p.position <= 3 ? 'text-gold' : 'text-txt'}`}>
                    P{p.position}
                  </td>
                  <td className="py-2 font-sans text-[14px] text-txt">
                    <Link href={p.href} className="group-hover:text-gold underline-offset-4 group-hover:underline">
                      {p.track}
                    </Link>
                    <span className="block font-mono text-[10px] tracking-[.1em] uppercase text-txt-3 mt-0.5">
                      {p.season} · {p.car ?? p.carClass}
                      {p.isWet ? ' · Wet' : ''} · of {nf.format(p.boardSize)}
                    </span>
                  </td>
                  <td className="py-2 text-right font-mono text-[13px] text-txt-2">
                    <Link href={p.href} className="hover:text-gold">
                      {msToLaptime(p.bestLapMs)} →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Block>
      )}
    </div>
  );
}
