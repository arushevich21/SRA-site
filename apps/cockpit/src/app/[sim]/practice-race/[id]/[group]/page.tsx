import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { DivisionBadge } from '@/components/DivisionBadge';
import { ResultsTabs } from '@/components/ResultsTabs';
import { getCalendarEventById } from '@/lib/calendar-events-store';
import { getAccRaceEventSessions } from '@/lib/acc/race-results-store';
import { getAccTrack } from '@/lib/acc/tracks';
import { isPracticeRaceEvent, practiceRaceGroup } from '@/lib/acc/practice-race';
import { getPracticeRaceEvents } from '@/lib/acc/practice-race-store';
import { getDriverInfoBySteamIds } from '@/lib/driver-lookup';

// One grid's practice-race results — the same tabs a round's results page
// shows, headed by the grid's divisions rather than a round number (a
// practice race is not Race 1 / Race 2 of anything).

export const revalidate = 300;

type PageProps = { params: Promise<{ sim: string; id: string; group: string }> };

export default async function PracticeRaceResultsPage({ params }: PageProps) {
  const { sim: simSlug, id, group: groupKey } = await params;
  const sim = getSimBySlug(simSlug);
  if (!sim || sim.slug !== 'acc') notFound();
  const group = practiceRaceGroup(groupKey);
  if (!group) notFound();

  const event = await getCalendarEventById(id);
  if (!event || !isPracticeRaceEvent(event)) notFound();

  const race = (await getPracticeRaceEvents(event)).get(group.key);
  if (!race) notFound();

  const sessions = await getAccRaceEventSessions(race.eventKey);
  if (sessions.length === 0) notFound();

  const header = sessions.find((s) => s.sessionType === 'Race') ?? sessions[0];
  const track = await getAccTrack(header.track);

  // Division/tier badges on each row — see [sim]/results/[eventKey]/page.tsx.
  const driverInfo = Object.fromEntries(
    await getDriverInfoBySteamIds(
      sessions.flatMap((s) =>
        s.results.map((r) => r.currentDriverSteamId ?? r.drivers[0]?.steamId).filter((id) => !!id),
      ),
    ),
  );

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <Link
        href={`/${sim.slug}/practice-race/${event.id}`}
        className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 hover:text-gold transition-colors mb-5"
      >
        ← {event.title}
      </Link>
      <span
        className="block font-mono text-[15px] tracking-[.3em] uppercase mb-5"
        style={{ color: 'var(--sim-accent)' }}
      >
        — Practice Race Results ({group.label})
      </span>
      <h1 className="font-display font-black text-[clamp(36px,5vw,64px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-3">
        {track?.displayName ?? header.track}
      </h1>
      <div className="flex items-center gap-2 mb-3">
        {group.divisionIds.map((d) => (
          <DivisionBadge key={d} division={d} height={32} />
        ))}
      </div>
      <p className="font-mono text-[12px] text-txt-3 mb-10">
        {new Date(header.date ?? race.date).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })}
      </p>

      <ResultsTabs sessions={sessions} driverInfo={driverInfo} />
    </section>
  );
}
