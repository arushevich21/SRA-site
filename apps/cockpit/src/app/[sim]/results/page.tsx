import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { getAccRaceEvents } from '@/lib/acc/race-results-store';
import { getAccTracks } from '@/lib/acc/tracks';
import { GameLabel } from '@/components/GameLabel';

// Event list, not results content — small and bounded (no per-lap data).
// No documented reason for force-dynamic and no dynamic API dependency;
// switched to ISR (2026-08-25) to cut Vercel usage.
export const revalidate = 300;

export default async function SimResultsPage({
  params,
}: {
  params: Promise<{ sim: string }>;
}) {
  const { sim: slug } = await params;
  const sim = getSimBySlug(slug);
  if (!sim) notFound();

  // Only ACC has a full race-results pipeline so far — acc_race_sessions is
  // ACC-only data. Other sims fall back to "coming soon", same pattern as
  // [sim]/standings when a game has no live data source yet.
  const events = sim.slug === 'acc' ? await getAccRaceEvents() : [];
  const tracks = sim.slug === 'acc' ? await getAccTracks() : [];
  const trackDisplayName = new Map(tracks.map((t) => [t.trackKey, t.displayName]));

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span
        className="block font-mono text-[15px] tracking-[.3em] uppercase mb-5"
        style={{ color: 'var(--sim-accent)' }}
      >
        — <GameLabel game={sim.game} /> Results
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-16">
        Results
      </h1>

      {sim.slug !== 'acc' && (
        <div className="border border-line/50 bg-carbon-2 px-8 py-12 text-center">
          <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3">
            Coming soon
          </p>
        </div>
      )}

      {sim.slug === 'acc' && events.length === 0 && (
        <div className="border border-line/50 bg-carbon-2 px-8 py-12 text-center">
          <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3">
            No race results yet — coming soon
          </p>
        </div>
      )}

      {sim.slug === 'acc' && events.length > 0 && (
        <div className="flex flex-col gap-3">
          {events.map((event) => (
            <Link
              key={event.eventKey}
              href={`/${sim.slug}/results/${encodeURIComponent(event.eventKey)}`}
              className="flex items-center justify-between gap-4 border border-line bg-panel px-5 py-4 hover:border-gold/50 hover:bg-panel-2 transition-colors"
            >
              <div>
                <span className="font-display font-bold text-[16px] uppercase text-txt">
                  {event.serverName}
                </span>
                {event.serverName && (
                  <span className="block font-sans text-[13px] text-txt-3 mt-1">
                    {trackDisplayName.get(event.track) ?? event.track}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3">
                  {event.seasonId ? 'Championship' : 'Custom Race'}
                </span>
                <span className="font-mono text-[12px] text-txt-2">
                  {new Date(event.date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
