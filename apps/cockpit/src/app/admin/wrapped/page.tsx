import Link from 'next/link';
import { requireAdmin } from '@/lib/require-admin';
import { getSnapshotStatus, WRAPPED_UNTIL } from '@/lib/wrapped/snapshot';
import { GenerateButton } from './GenerateButton';

export const dynamic = 'force-dynamic';
// Generating the snapshot builds ~175 cards and reads the race servers' standings.
export const maxDuration = 300;

// Season 19 Wrapped: build the snapshot drivers' pages read from, and check
// its state. Drivers see nothing until a snapshot exists.
export default async function AdminWrappedPage() {
  await requireAdmin();
  const status = await getSnapshotStatus();
  const until = new Date(WRAPPED_UNTIL).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'America/New_York',
  });

  return (
    <section className="max-w-[900px] mx-auto px-7 pt-14 pb-24">
      <Link href="/admin" className="inline-flex items-center gap-2 font-sans text-[13px] text-txt-3 hover:text-gold transition-colors mb-5">
        ← Admin
      </Link>
      <h1 className="font-display font-black text-[clamp(36px,5vw,56px)] leading-[.9] tracking-[-1px] text-txt mb-6">
        Season 19 Wrapped
      </h1>

      <div className="border border-line bg-panel px-6 py-6 mb-8">
        <h2 className="font-display font-bold text-[22px] text-txt mb-2">Snapshot</h2>
        {'error' in status ? (
          <p className="font-sans text-[14px] text-red-400 mb-4">
            Can’t read the Wrapped tables ({status.error}). Run supabase/migrations/20261124_wrapped.sql first.
          </p>
        ) : (
          <p className="font-sans text-[14px] text-txt-2 mb-4">
            {status.cards > 0
              ? `${status.cards} driver cards stored${status.generatedAt ? `, generated ${new Date(status.generatedAt).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })} ET` : ''}.`
              : 'No snapshot yet. Drivers see the league recap until you generate one.'}
          </p>
        )}
        <GenerateButton />
        <p className="font-sans text-[13px] text-txt-3 mt-4 leading-relaxed">
          Builds every Season 19 GT3 Team Series driver’s card from current data and stores it. Re-running updates the
          cards and keeps share links working. It takes up to a minute.
        </p>
      </div>

      <div className="border border-line bg-panel px-6 py-6">
        <h2 className="font-display font-bold text-[22px] text-txt mb-3">Launch</h2>
        <p className="font-sans text-[14px] text-txt-2 leading-relaxed">
          Until {until}, signed-in drivers with a card get a one-time prompt to watch theirs, the homepage shows a
          Wrapped card, and the nav has a Wrapped link. After that, /wrapped/s19 still works.
        </p>
        <div className="flex gap-5 mt-4 font-sans text-[14px] font-semibold">
          <Link href="/wrapped/s19" className="text-gold hover:text-gold-soft">
            Your Wrapped
          </Link>
          <Link href="/wrapped/s19/prototype" className="text-gold hover:text-gold-soft">
            Preview any driver
          </Link>
        </div>
      </div>
    </section>
  );
}
