'use client';

import type { SRatingRow } from '@/lib/acc/srating';
import { srowId } from '@/components/SRatingLeaderboard';
import { useCurrentDriverContext } from '@/hooks/useCurrentDriverContext';

function fmtPct(v: number | null): string {
  return v == null ? '—' : `${(v * 100).toFixed(1)}%`;
}

function Bar({ pct }: { pct: number | null }) {
  return (
    <div className="h-1.5 bg-line/40 overflow-hidden">
      <div
        className="h-full"
        style={{
          width: `${Math.max(0, Math.min(100, (pct ?? 0) * 100))}%`,
          backgroundColor: 'var(--sim-accent)',
        }}
      />
    </div>
  );
}

function MetricRow({ label, pct }: { label: string; pct: number | null }) {
  return (
    <div>
      <div className="flex items-center justify-between font-mono text-[11px] uppercase text-txt-3 mb-1">
        <span>{label}</span>
        <span className="text-txt-2">{fmtPct(pct)}</span>
      </div>
      <Bar pct={pct} />
    </div>
  );
}

// Only renders once we've matched the signed-in driver against a row in
// the (already-fetched) leaderboard — signed-out visitors and drivers with
// no driver_ratings row (not enough race history yet) see nothing here
// rather than an empty/placeholder card.
export function SRatingSelfCard({ rows }: { rows: SRatingRow[] }) {
  const { driverId } = useCurrentDriverContext();
  if (!driverId) return null;

  const mine = rows.find((r) => r.driverId === driverId);
  if (!mine) return null;

  return (
    <div className="border border-line bg-panel px-6 py-5 w-full lg:w-[280px] shrink-0">
      <div className="flex items-center justify-between mb-3">
        <div className="font-mono text-[11px] tracking-[.25em] uppercase text-txt-3">
          Your SRAting
        </div>
        <button
          type="button"
          onClick={() =>
            document
              .getElementById(srowId(mine.driverId))
              ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
          className="font-mono text-[10px] tracking-[.15em] uppercase bg-gold text-carbon px-2.5 py-1 hover:bg-gold-soft transition-colors cursor-pointer whitespace-nowrap"
        >
          Jump to Rank
        </button>
      </div>
      <div className="flex items-baseline gap-3 mb-4">
        <span
          className="font-display font-black text-[34px] leading-none"
          style={{ color: 'var(--sim-accent)' }}
        >
          {fmtPct(mine.composite)}
        </span>
        <span className="font-mono text-[13px] text-txt-3">
          Rank #{mine.rank} <span className="text-txt-3/70">of {rows.length}</span>
        </span>
      </div>
      <div className="flex flex-col gap-3">
        <MetricRow label="Pace" pct={mine.pacePct} />
        <MetricRow label="Racecraft" pct={mine.osPct} />
      </div>
    </div>
  );
}
