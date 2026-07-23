import Link from 'next/link';
import { requireAdmin } from '@/lib/require-admin';
import { getChampionshipAdminList } from '@/lib/championships-store';
import { DeleteButton } from './DeleteButton';

export const dynamic = 'force-dynamic';

export default async function AdminEventsPage() {
  await requireAdmin();
  const events = await getChampionshipAdminList();

  return (
    <section className="max-w-[960px] mx-auto px-7 pt-14 pb-24">
      <Link href="/admin"
        className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 hover:text-gold transition-colors mb-5">
        ← Go back
      </Link>
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">— Admin</span>
      <div className="flex items-center justify-between mb-10 flex-wrap gap-4">
        <h1 className="font-display font-black text-[clamp(36px,5vw,56px)] uppercase leading-[.9] tracking-[-1px] text-txt">
          Events
        </h1>
        <Link href="/admin/events/new"
          className="bg-gold text-carbon font-mono text-[12px] tracking-[.2em] uppercase font-bold px-5 py-2.5 hover:bg-gold-soft transition-colors">
          + New event
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="border border-line/50 bg-carbon-2 px-8 py-12 text-center">
          <p className="font-mono text-[13px] tracking-[.2em] uppercase text-txt-3">No events yet</p>
        </div>
      ) : (
        <div className="border border-line">
          {events.map((e, i) => (
            <div key={e.id}
              className={['flex items-center gap-4 px-5 py-4 flex-wrap', i < events.length - 1 ? 'border-b border-line/50' : ''].join(' ')}>
              <span className="font-mono text-[12px] text-txt-3 w-8 shrink-0">{e.sortOrder}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-display font-bold text-[16px] uppercase text-txt">{e.title}</span>
                  <span className="font-mono text-[10px] tracking-[.2em] uppercase text-txt-3 border border-line px-1.5 py-[1px]">{e.game}</span>
                  {e.teaserOnly && <span className="font-mono text-[10px] tracking-[.2em] uppercase text-txt-3/60 border border-txt-3/20 px-1.5 py-[1px]">teaser</span>}
                  {e.concluded && <span className="font-mono text-[10px] tracking-[.2em] uppercase text-txt-3/60 border border-txt-3/20 px-1.5 py-[1px]">concluded</span>}
                </div>
                <span className="font-mono text-[11px] text-txt-3">{e.slug} · {e.roundCount} round(s)</span>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <Link href={`/admin/events/${e.id}`}
                  className="font-mono text-[11px] tracking-[.15em] uppercase text-gold hover:text-gold-soft">
                  Edit
                </Link>
                <DeleteButton id={e.id} title={e.title} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
