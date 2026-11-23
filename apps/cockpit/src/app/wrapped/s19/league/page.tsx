import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { LeagueStory } from '@/components/wrapped/LeagueStory';
import { getSummary } from '@/lib/wrapped/snapshot';

// The league's Season 19, wrapped: the GT3 Team Series as a whole and its
// champions. Public — it's the league's story, built from public results.

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'www.simracingalliance.com';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const image = `${proto}://${host}/wrapped/s19/league/image`;
  const title = 'Season 19 of the GT3 Team Series, wrapped';
  const description = 'The season in numbers, its standouts, and the Season 19 champions.';
  return {
    title: `${title} · Sim Racing Alliance`,
    description,
    openGraph: { title, description, images: [{ url: image, width: 1080, height: 1350 }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

export default async function LeagueWrappedPage() {
  const league = await getSummary();
  return (
    <section className="min-h-[calc(100dvh-76px)] flex flex-col items-center justify-center gap-6 px-4 py-6">
      {league ? (
        <LeagueStory
          league={league}
          share={{ url: '/wrapped/s19/league', imageUrl: '/wrapped/s19/league/image' }}
        />
      ) : (
        <p className="font-sans text-[16px] text-txt-2">Season 19 Wrapped isn&apos;t out yet.</p>
      )}
      <Link
        href="/wrapped/s19"
        className="font-sans font-semibold text-[15px] hover:underline"
        // Inline: globals.css's unlayered `a { color: inherit }` beats text-* utilities on links.
        style={{ color: '#E6B53D' }}
      >
        Your own Wrapped
      </Link>
    </section>
  );
}
