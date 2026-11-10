import { getSiteTotals, getStatsLeaderboards } from '@/lib/site-stats';
import { StatsLeaderboard } from '@/components/StatsLeaderboard';

// Reads the nightly rollups (refreshed 09:15 UTC), so an hourly regenerate
// is plenty — same cadence as the driver pages.
export const revalidate = 3600;

const nf = new Intl.NumberFormat('en-US');
const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export default async function StatsPage() {
  const [totals, boards] = await Promise.all([getSiteTotals(), getStatsLeaderboards()]);

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">
        — About
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-10">
        Statistics
      </h1>

      {/* Platform Metrics */}
      {totals && (
        <>
          <h2 className="font-display font-bold text-[28px] uppercase text-txt mt-16 mb-6">
            Platform Metrics
          </h2>
          {totals.firstSessionAt && (
            <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 mb-6">
              Since {dateFmt.format(new Date(totals.firstSessionAt))}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
            {[
              { value: totals.laps, label: 'Total Laps' },
              { value: totals.sessions, label: 'Total Sessions' },
              { value: totals.drivers, label: 'Drivers on Track' },
            ].map((stat) => (
              <div key={stat.label} className="border border-line bg-panel p-6">
                <span className="font-display text-[48px] text-gold leading-none">
                  {nf.format(stat.value)}
                </span>
                <span className="block font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 mt-2">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Leaderboards */}
      {boards.length > 0 && (
        <>
          <div className="h-px bg-line my-12" />
          <h2 className="font-display font-bold text-[28px] uppercase text-txt mt-16 mb-6">
            Leaderboards
          </h2>
          <StatsLeaderboard categories={boards} />
        </>
      )}

      <div className="h-px bg-line my-12" />

      {/* Footer Note */}
      <div className="border border-line bg-panel p-6">
        <span className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 mb-2 block">
          Data Note
        </span>
        <p className="font-sans text-sm text-txt-2 leading-relaxed">
          ACC laps and sessions from every SRA server — league, practice and time trial — counted
          once per session. Wins, podiums and top 10s are GT3 Series finishes within each
          division. Updated nightly
          {totals ? <> (last {dateFmt.format(new Date(totals.computedAt))})</> : null}.
        </p>
      </div>
    </section>
  );
}
