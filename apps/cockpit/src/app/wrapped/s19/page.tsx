import type { Metadata } from 'next';
import { LeagueStory } from '@/components/wrapped/LeagueStory';
import { WrappedRecap } from '@/components/wrapped/WrappedRecap';
import { getWrappedViewer } from '@/lib/wrapped/session';
import { getCardForSteam, getSummary } from '@/lib/wrapped/snapshot';
import { WrappedViewer } from './WrappedViewer';

// Your own Season 19 Wrapped. Private by default: only the signed-in
// driver's card is ever loaded here (identity from the session, never the
// URL). Sharing goes through the per-card token link, /wrapped/s19/s/<token>.
// Without a card of your own you get the league's season instead.

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

  const league = await getSummary();
  return (
    <section className="min-h-[calc(100dvh-76px)] flex flex-col items-center justify-center gap-8 px-4 py-6">
      {league && (
        <LeagueStory
          league={league}
          share={{ url: '/wrapped/s19/league', imageUrl: '/wrapped/s19/league/image' }}
        />
      )}
      <WrappedRecap reason={viewer ? 'no-card' : 'signed-out'} />
    </section>
  );
}
