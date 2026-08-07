import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { GameLabel } from '@/components/GameLabel';
import { SRatingLeaderboard } from '@/components/SRatingLeaderboard';
import { SRatingSelfCard } from '@/components/SRatingSelfCard';
import { formatComputedAt, getSRatingData } from '@/lib/acc/srating';

// driver_ratings is populated by an external pipeline on a fixed weekly
// cadence (Thursday night), not continuously — so this page is refreshed
// on-demand by /api/cron/refresh-srating (scheduled for Thursday 23:55)
// rather than on a time-based interval. No `revalidate` export means the
// page is cached indefinitely between those on-demand busts.

// SRAting is GT3-only for now (srating_history.series defaults to 'GT3'),
// so this page only exists under /acc.
export default async function SRatingPage({
  params,
}: {
  params: Promise<{ sim: string }>;
}) {
  const { sim: slug } = await params;
  const sim = getSimBySlug(slug);
  if (!sim) notFound();
  if (sim.game !== 'ACC') notFound();

  const { rows, computedAt } = await getSRatingData();

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8 mb-10">
        <div>
          <span
            className="block font-mono text-[15px] tracking-[.3em] uppercase mb-5"
            style={{ color: 'var(--sim-accent)' }}
          >
            — <GameLabel game={sim.game} /> SRAting
          </span>
          {/* The badge already carries the "SRAting" wordmark, so it
              replaces the usual text h1 outright instead of sitting next
              to one. */}
          <h1 className="mb-6">
            <Image
              src="/badges/srating-logo.png"
              alt="SRAting"
              width={1773}
              height={682}
              priority
              className="w-full max-w-[480px] h-auto"
            />
          </h1>
          <p className="font-sans text-[15px] text-txt-2 leading-relaxed max-w-[640px] mb-3">
            SRA&apos;s driver rating system: <span className="text-txt">80% pace</span>, measured
            against the field&apos;s own reference times, and{' '}
            <span className="text-txt">20% racecraft</span>, a race-result-based skill estimate
            that guards against sandbagging.
          </p>
          {computedAt && (
            <p className="font-mono text-[12px] text-txt-3">
              Data last computed {formatComputedAt(computedAt)} · page refreshes weekly
            </p>
          )}
        </div>

        <SRatingSelfCard rows={rows} />
      </div>

      <SRatingLeaderboard rows={rows} />
    </section>
  );
}
