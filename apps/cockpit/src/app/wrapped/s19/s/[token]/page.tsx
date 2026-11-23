import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { WrappedStory } from '@/components/wrapped/WrappedStory';
import { WrappedRecap } from '@/components/wrapped/WrappedRecap';
import { getCardByToken, getSummary } from '@/lib/wrapped/snapshot';

// A shared Wrapped: public to whoever holds the link (the token is 16 random
// bytes, so cards can't be enumerated), never indexed. The poster image is
// the link preview in Discord and elsewhere.

export const dynamic = 'force-dynamic';

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'www.simracingalliance.com';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const card = await getCardByToken(token);
  if (!card) return { title: 'Season 19 Wrapped · Sim Racing Alliance', robots: { index: false, follow: false } };
  const base = await origin();
  const image = `${base}/wrapped/s19/s/${token}/image`;
  const title = `${card.name}'s Season 19 Wrapped`;
  const description = `${card.archetype.title}. ${Math.round(card.numbers.km).toLocaleString('en-US')} km in the GT3 Team Series.`;
  return {
    title: `${title} · Sim Racing Alliance`,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, url: `${base}/wrapped/s19/s/${token}`, images: [{ url: image, width: 1080, height: 1350 }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

export default async function SharedWrappedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const card = await getCardByToken(token);
  if (!card) notFound();
  const path = `/wrapped/s19/s/${token}`;
  const summary = await getSummary();
  return (
    <section className="flex flex-col items-center gap-10 px-4 py-6">
      <WrappedStory card={card} share={{ url: path, imageUrl: `${path}/image` }} />
      <WrappedRecap summary={summary} reason="shared" />
    </section>
  );
}
