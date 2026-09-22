import Link from 'next/link';
import { WEATHER } from '@/components/stream/RevealOverlay';
import { isTbaTrack } from '@/components/stream/track-maps';
import { roundStartsAtForDivision } from '@/content/championships';
import { requireAdmin } from '@/lib/require-admin';
import { eventDateTimeParts } from '@/lib/event-time';
import { seasonShort } from '@/lib/stream/labels';
import { getStreamChampionship, streamDivisionIds } from '@/lib/stream/overlay-data';
import { roundWeather } from '@/lib/stream/thumbnail-weather';

export const dynamic = 'force-dynamic';

// Every race night's YouTube/Twitch thumbnail for the series on air, one row
// per round, one card per division — each a link to the PNG the /thumbnail
// route renders, and a download link. ?championship=<slug> for another
// series. The weather badge comes from lib/stream/thumbnail-weather.ts.

export default async function AdminThumbnailsPage({
  searchParams,
}: {
  searchParams: Promise<{ championship?: string }>;
}) {
  await requireAdmin();
  const { championship: slug } = await searchParams;
  const championship = await getStreamChampionship(slug);
  const divisionIds = championship ? streamDivisionIds(championship) : [];
  const rounds = championship ? [...championship.schedule].sort((a, b) => a.round - b.round) : [];

  return (
    <section className="max-w-[1400px] mx-auto px-7 pt-14 pb-24">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 hover:text-gold transition-colors mb-5"
      >
        ← Go back
      </Link>
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">— Admin</span>
      <h1 className="font-display font-black text-[clamp(36px,5vw,56px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-4">
        Stream Thumbnails
      </h1>

      {!championship ? (
        <p className="font-mono text-[12px] text-red-400">No streamable championship found.</p>
      ) : (
        <>
          <p className="font-mono text-[12px] text-txt-3 mb-4">
            {championship.title} · {rounds.length} rounds · divisions {divisionIds.join(', ')}. Click a
            card for the full 1280×720 PNG; “Download” saves it named for the round. Add{' '}
            <code>?weather=sunny|wet|night|variable</code> to a thumbnail URL to override the badge.
          </p>
          <a
            href={`/thumbnail/${championship.slug}/zip`}
            className="inline-block mb-10 border border-gold/40 px-4 py-2 font-mono text-[11px] tracking-[.2em] uppercase text-gold hover:bg-gold/10 transition-colors"
          >
            Download all ({rounds.length * divisionIds.length} PNGs, zip)
          </a>

          <div className="flex flex-col gap-10">
            {rounds.map((round) => {
              const weather = roundWeather(championship.slug, round.round);
              const tba = isTbaTrack(round.track);
              return (
                <div key={round.round}>
                  <h2 className="font-display font-bold text-[20px] uppercase text-txt mb-3">
                    Round {round.round} — {tba ? 'Track TBA' : round.track}
                    <span className="ml-3 font-mono text-[11px] tracking-[.15em] text-txt-3">
                      {weather ? WEATHER[weather].label : 'no weather badge'}
                    </span>
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    {divisionIds.map((divisionId) => {
                      const href = `/thumbnail/${championship.slug}/${round.round}/${divisionId}`;
                      const startsAt = roundStartsAtForDivision(round, divisionId);
                      const when = startsAt ? eventDateTimeParts(startsAt, 'America/New_York') : null;
                      return (
                        <div key={divisionId} className="border border-white/10 bg-white/[.03]">
                          <a href={href} target="_blank" rel="noreferrer" className="block">
                            {/* eslint-disable-next-line @next/next/no-img-element -- dynamic PNG from our own route */}
                            <img src={href} alt={`${seasonShort(championship)} R${round.round} D${divisionId}`} className="w-full aspect-video object-cover" />
                          </a>
                          <div className="flex items-center justify-between px-3 py-2 font-mono text-[11px] tracking-[.15em] uppercase">
                            <span className="text-txt">
                              D{divisionId}
                              {when && <span className="ml-2 text-txt-3">{when.date}</span>}
                            </span>
                            <a href={`${href}?download=1`} className="text-gold hover:underline">
                              Download
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
