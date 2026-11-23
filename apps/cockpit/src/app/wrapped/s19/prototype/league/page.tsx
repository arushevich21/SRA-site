import type { Metadata } from 'next';
import Link from 'next/link';
import { LeagueStory } from '@/components/wrapped/LeagueStory';
import { requireAdmin } from '@/lib/require-admin';
import { buildLeagueLive } from '@/lib/wrapped/snapshot';

// Admin preview of the league Wrapped, built live (before a snapshot exists,
// or to check a change). Builds every driver's card, so it takes a moment.

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'League Wrapped preview · SRA',
  robots: { index: false, follow: false },
};

export default async function LeagueWrappedPreviewPage() {
  await requireAdmin();
  const league = await buildLeagueLive();
  return (
    <section className="max-w-[1180px] mx-auto px-5 sm:px-7 pt-12 pb-24 flex flex-col items-center gap-6">
      <h1 className="font-display font-black text-[clamp(32px,4.5vw,52px)] leading-[.9] text-txt self-start">
        League Wrapped preview
      </h1>
      <LeagueStory league={league} />
      <Link
        href="/wrapped/s19/prototype"
        className="font-sans font-semibold text-[14px] text-gold hover:text-gold-soft"
      >
        Preview a driver instead
      </Link>
    </section>
  );
}
