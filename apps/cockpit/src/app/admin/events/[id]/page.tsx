import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/require-admin';
import { getChampionshipRowById } from '@/lib/championships-store';
import { getEventRegistrationSummary } from '@/lib/registrations';
import { EventForm } from '../EventForm';
import { rowToInput } from '../row-to-input';
import { PromoteButton } from '../PromoteButton';

export const dynamic = 'force-dynamic';

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const row = await getChampionshipRowById(id);
  if (!row) notFound();

  // Nothing to show until the event has a registration key/season assigned
  // (see the "Registration" section of the form above) — registrations are
  // keyed by those, not the championship's DB id.
  const summary =
    row.registration_key && row.registration_season
      ? await getEventRegistrationSummary(row.registration_key, row.registration_season, row.max_registrations)
      : null;

  return (
    <section className="max-w-[960px] mx-auto px-7 pt-14 pb-24">
      <Link href="/admin/events"
        className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 hover:text-gold transition-colors mb-5">
        ← Events
      </Link>
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">— Admin</span>
      <h1 className="font-display font-black text-[clamp(36px,5vw,56px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-10">
        Edit Event
      </h1>

      <EventForm initial={rowToInput(row)} isEdit />

      {summary && (
        <div className="mt-14 border-t border-line pt-8">
          <h2 className="font-display font-bold text-[16px] uppercase text-gold mb-4">Registrations</h2>
          <p className="font-mono text-[13px] text-txt-2 mb-6">
            {summary.confirmedCount} confirmed
            {summary.maxRegistrations != null ? ` / ${summary.maxRegistrations} max` : ' (no cap)'}
          </p>

          <h3 className="font-mono text-[11px] tracking-[.3em] uppercase text-txt-3 mb-3">
            Waitlist ({summary.waitlisted.length})
          </h3>
          {summary.waitlisted.length === 0 ? (
            <p className="font-mono text-[12px] text-txt-3">No waitlisted entries.</p>
          ) : (
            <div className="border border-line">
              {summary.waitlisted.map((w, i) => (
                <div key={w.id}
                  className={['flex items-center gap-4 px-5 py-3 flex-wrap', i < summary.waitlisted.length - 1 ? 'border-b border-line/50' : ''].join(' ')}>
                  <span className="font-mono text-[12px] text-txt-3 w-8 shrink-0">#{w.waitlistPosition}</span>
                  <div className="min-w-0 flex-1">
                    <span className="font-display font-bold text-[14px] uppercase text-txt">
                      {w.teamName ?? 'Unnamed entry'}
                    </span>
                    {w.raceNumber != null && (
                      <span className="font-mono text-[11px] text-txt-3 ml-2">#{w.raceNumber}</span>
                    )}
                    {w.entryClass && (
                      <span className="font-mono text-[11px] text-txt-3 ml-2">{w.entryClass}</span>
                    )}
                  </div>
                  <PromoteButton registrationId={w.id} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
