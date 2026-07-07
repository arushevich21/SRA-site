import Link from 'next/link';

export default function LeMansUltimatePage() {
  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">
        — About
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-10">
        Le Mans Ultimate
      </h1>

      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-10 max-w-2xl">
        SRA&apos;s Multiclass Mayhem championship runs on Le Mans Ultimate. See
        the Championships page for the current season schedule and standings.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
        <Link
          href="/championships"
          className="block border border-line bg-panel p-6 hover:border-gold/40 transition-colors"
        >
          <span className="font-display font-bold text-[20px] uppercase text-gold">
            Championships &rarr;
          </span>
          <p className="font-sans text-sm text-txt-3 mt-2">
            Current season schedule and results
          </p>
        </Link>

        <Link
          href="/calendar"
          className="block border border-line bg-panel p-6 hover:border-gold/40 transition-colors"
        >
          <span className="font-display font-bold text-[20px] uppercase text-gold">
            Race Calendar &rarr;
          </span>
          <p className="font-sans text-sm text-txt-3 mt-2">
            Upcoming race dates and tracks
          </p>
        </Link>
      </div>
    </section>
  );
}
