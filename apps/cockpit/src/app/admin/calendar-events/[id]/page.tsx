import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/require-admin';
import { getCalendarEventById } from '@/lib/calendar-events-store';
import { CalendarEventForm } from '../CalendarEventForm';
import { rowToInput } from '../row-to-input';

export const dynamic = 'force-dynamic';

export default async function EditCalendarEventPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const row = await getCalendarEventById(id);
  if (!row) notFound();

  return (
    <section className="max-w-[960px] mx-auto px-7 pt-14 pb-24">
      <Link href="/admin/calendar-events"
        className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 hover:text-gold transition-colors mb-5">
        ← Calendar Events
      </Link>
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">— Admin</span>
      <h1 className="font-display font-black text-[clamp(36px,5vw,56px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-10">
        Edit Calendar Event
      </h1>

      <CalendarEventForm initial={rowToInput(row)} isEdit />
    </section>
  );
}
