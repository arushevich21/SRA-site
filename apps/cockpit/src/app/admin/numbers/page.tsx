import { requireAdmin } from '@/lib/require-admin';
import { getNumbersLocked } from '@/lib/settings';
import { getPurgeData } from '@/lib/driver-numbers';
import Link from 'next/link';
import NumbersAdmin from './NumbersAdmin';

export const dynamic = 'force-dynamic';

export default async function AdminNumbersPage() {
  await requireAdmin();

  const [locked, purge] = await Promise.all([getNumbersLocked(), getPurgeData()]);

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <Link
        href="/admin"
        className="inline-block mb-8 font-mono text-[11px] tracking-[.15em] uppercase text-txt-3 hover:text-gold transition-colors"
      >
        ← Back to admin
      </Link>
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">
        — Admin
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-10">
        Driver Numbers
      </h1>

      <NumbersAdmin locked={locked} purge={purge} />
    </section>
  );
}
