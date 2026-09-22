import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { DivisionBadge } from '@/components/DivisionBadge';
import { getCalendarEventById } from '@/lib/calendar-events-store';
import { getAccTrack } from '@/lib/acc/tracks';
import { PRACTICE_RACE_GROUPS, isPracticeRaceEvent } from '@/lib/acc/practice-race';
import { getPracticeRaceEvents } from '@/lib/acc/practice-race-store';

// "Pick which race": the Monday practice race is two grids at once (D1/D2 on
// SRAM1, D3/D4 on SRAM2), so the calendar entry lands here first and the
// driver picks theirs. Reached only from the calendar — see
// lib/acc/practice-race.ts.

export const revalidate = 300;

type PageProps = { params: Promise<{ sim: string; id: string }> };

export default async function PracticeRacePickerPage({ params }: PageProps) {
  const { sim: simSlug, id } = await params;
  const sim = getSimBySlug(simSlug);
  if (!sim || sim.slug !== 'acc') notFound();

  const event = await getCalendarEventById(id);
  if (!event || !isPracticeRaceEvent(event)) notFound();

  const races = await getPracticeRaceEvents(event);
  const anyRace = races.values().next().value;
  const track = anyRace ? await getAccTrack(anyRace.track) : null;

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <Link
        href={`/${sim.slug}/calendar`}
        className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 hover:text-gold transition-colors mb-5"
      >
        ← Calendar
      </Link>
      <span
        className="block font-mono text-[15px] tracking-[.3em] uppercase mb-5"
        style={{ color: 'var(--sim-accent)' }}
      >
        — Practice Race Results
      </span>
      <h1 className="font-display font-black text-[clamp(36px,5vw,64px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-3">
        {event.title}
      </h1>
      {track && <p className="font-sans text-sm text-txt-3 mb-1">{track.displayName}</p>}
      <p className="font-mono text-[12px] text-txt-3 mb-10">
        {new Date(anyRace?.date ?? event.eventDate).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })}
      </p>

      <p className="font-mono text-[12px] tracking-[.2em] uppercase text-txt-3 mb-4">Pick which race</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PRACTICE_RACE_GROUPS.map((group) => {
          const race = races.get(group.key);
          const body = (
            <>
              <span className="flex items-center gap-2">
                {group.divisionIds.map((d) => (
                  <DivisionBadge key={d} division={d} height={44} />
                ))}
              </span>
              <span className="font-display font-black text-[28px] uppercase leading-none text-txt">
                ({group.label})
              </span>
              <span className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3">
                {race ? 'View results →' : 'No results posted yet'}
              </span>
            </>
          );
          const className =
            'flex flex-col items-start gap-4 border border-line/50 bg-carbon-2 px-8 py-8 transition-colors';
          return race ? (
            <Link
              key={group.key}
              href={`/${sim.slug}/practice-race/${event.id}/${group.key}`}
              className={`${className} hover:border-gold/60 hover:bg-panel`}
            >
              {body}
            </Link>
          ) : (
            <div key={group.key} className={`${className} opacity-60`}>
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}
