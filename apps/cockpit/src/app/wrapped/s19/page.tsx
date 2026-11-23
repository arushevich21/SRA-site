import type { Metadata } from 'next';
import { WrappedRecap } from '@/components/wrapped/WrappedRecap';
import { getWrappedViewer } from '@/lib/wrapped/session';
import { getCardForSteam, getSummary } from '@/lib/wrapped/snapshot';
import { WrappedViewer } from './WrappedViewer';

// Your own Season 19 Wrapped. Private by default: only the signed-in
// driver's card is ever loaded here (identity from the session, never the
// URL). Sharing goes through the per-card token link, /wrapped/s19/s/<token>.

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Season 19 Wrapped · Sim Racing Alliance',
  description: 'Your Season 19 GT3 Team Series, wrapped.',
};

export default async function WrappedS19Page() {
  const viewer = await getWrappedViewer();
  const mine = viewer?.steamId ? await getCardForSteam(viewer.steamId) : null;

  if (mine) {
    const path = `/wrapped/s19/s/${mine.token}`;
    return (
      <section className="min-h-[calc(100dvh-76px)] flex flex-col items-center justify-center px-4 py-6">
        <WrappedViewer card={mine.card} share={{ url: path, imageUrl: `${path}/image` }} />
      </section>
    );
  }

  const summary = await getSummary();
  return (
    <section className="min-h-[calc(100dvh-76px)] flex items-center justify-center px-4 py-10">
      <WrappedRecap summary={summary} reason={viewer ? 'no-card' : 'signed-out'} />
    </section>
  );
}
