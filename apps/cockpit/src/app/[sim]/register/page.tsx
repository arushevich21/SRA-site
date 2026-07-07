import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';

export default async function SimRegisterPage({
  params,
}: {
  params: Promise<{ sim: string }>;
}) {
  const { sim: slug } = await params;
  const sim = getSimBySlug(slug);
  if (!sim) notFound();

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span
        className="block font-mono text-[15px] tracking-[.3em] uppercase mb-5"
        style={{ color: 'var(--sim-accent)' }}
      >
        — {sim.game} Registration
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-16">
        Register
      </h1>

      <div className="border border-line/50 bg-carbon-2 px-8 py-12 text-center">
        <p className="font-mono text-[12px] tracking-[.2em] uppercase text-txt-3">
          Coming soon
        </p>
      </div>
    </section>
  );
}
