import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { RaceCalendar } from '@/components/RaceCalendar';
import { ServerStatusPanel } from '@/components/ServerStatusPanel';

// The master calendar (/calendar) filtered to one sim — same component, same
// entries, same labels. See RaceCalendar.
export default async function SimCalendarPage({ params }: { params: Promise<{ sim: string }> }) {
  const { sim: slug } = await params;
  const sim = getSimBySlug(slug);
  if (!sim) notFound();

  return (
    <>
      <RaceCalendar sim={sim} />
      {sim.game === 'ACC' && <ServerStatusPanel game={sim.game} accentColor={sim.accentColor} />}
    </>
  );
}
