import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/require-admin';
import { getCurrentDriverContext } from '@/lib/current-driver';
import { getS19Wrapped } from '@/lib/wrapped/s19-prototype';
import { WrappedPrototype, type Direction } from './WrappedPrototype';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'S19 Wrapped prototype · SRA',
  robots: { index: false, follow: false },
};

export default async function WrappedPrototypePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const q = await searchParams;
  const pick = (k: string) => (typeof q[k] === 'string' ? (q[k] as string) : undefined);
  const direction: Direction = pick('v') === 'b' || pick('v') === 'c' ? (pick('v') as Direction) : 'a';

  const me = await getCurrentDriverContext();
  let { roster, card } = await getS19Wrapped(pick('d') ?? me.steamId);
  // Not an S19 driver (or a bad ?d=): fall back to the first driver listed.
  if (!card && roster.length > 0) ({ roster, card } = await getS19Wrapped(roster[0].steamId));

  return (
    <section className="max-w-[1180px] mx-auto px-5 sm:px-7 pt-12 pb-24">
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-4">— Prototype</span>
      <h1 className="font-display font-black text-[clamp(36px,5vw,60px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-10">
        Season 19 Wrapped
      </h1>
      {card ? (
        <WrappedPrototype card={card} roster={roster} direction={direction} />
      ) : (
        <p className="font-sans text-txt-3">No Season 19 race data found.</p>
      )}
    </section>
  );
}
