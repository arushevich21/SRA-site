import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { getAccRaceEventSessions } from '@/lib/acc/race-results-store';
import { getAccTrack } from '@/lib/acc/tracks';
import { ResultsTabs } from '@/components/ResultsTabs';

export const dynamic = 'force-dynamic';

// ACCSM server names are "|"-delimited and mix boilerplate (server-manager
// tag, the league's own site URL, hosting/room tags) in with the one or two
// segments that actually distinguish this server (division/season/series) —
// strip the boilerplate segments, keep the rest, case-insensitive since the
// source data isn't consistently cased ("#SRAggTT", "cBOP").
const SERVER_NAME_NOISE = ['sraggtt', 'sragg', 'simracingalliance.com', '#sram', 'cbop'];

function cleanServerName(serverName: string | null): string | null {
  if (!serverName) return null;
  const kept = serverName
    .split('|')
    .map((part) => part.trim())
    .filter(
      (part) => part.length > 0 && !SERVER_NAME_NOISE.some((noise) => part.toLowerCase().includes(noise)),
    );
  return kept.length > 0 ? kept.join(' | ') : null;
}

type PageProps = {
  params: Promise<{ sim: string; eventKey: string }>;
};

export default async function SimResultsEventPage({ params }: PageProps) {
  const { sim: slug, eventKey } = await params;
  const sim = getSimBySlug(slug);
  // Only ACC has a race-results pipeline so far — no valid eventKey exists
  // for any other sim yet.
  if (!sim || sim.slug !== 'acc') notFound();

  // params.eventKey arrives still percent-encoded (matching the encodeURIComponent
  // used when building the link on the list page) rather than pre-decoded by
  // Next.js, so it must be decoded before it'll match the raw event_key stored
  // in Supabase.
  const sessions = await getAccRaceEventSessions(decodeURIComponent(eventKey));
  if (sessions.length === 0) notFound();

  // Any session carries the same track/server/metaData — prefer the Race
  // session's, since that's the one most likely to be open by default.
  const header = sessions.find((s) => s.sessionType === 'Race') ?? sessions[0];
  const displayServerName = cleanServerName(header.serverName);
  const track = await getAccTrack(header.track);
  const trackDisplayName = track?.displayName ?? header.track;

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <Link
        href={`/${sim.slug}/results`}
        className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 hover:text-gold transition-colors mb-5"
      >
        ← All Results
      </Link>
      <span
        className="block font-mono text-[15px] tracking-[.3em] uppercase mb-5"
        style={{ color: 'var(--sim-accent)' }}
      >
        — Results
      </span>
      <h1 className="font-display font-black text-[clamp(36px,5vw,64px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-3">
        {trackDisplayName}
      </h1>
      {displayServerName && (
        <p className="font-sans text-sm text-txt-3 mb-1">
          {displayServerName}
        </p>
      )}
      {header.date && (
        <p className="font-mono text-[12px] text-txt-3 mb-10">
          {new Date(header.date).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      )}

      <ResultsTabs sessions={sessions} />
    </section>
  );
}
