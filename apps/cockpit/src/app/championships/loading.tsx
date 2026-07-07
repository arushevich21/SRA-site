export default function ChampionshipsLoading() {
  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">
        — Championships
      </span>
      <div className="h-[clamp(44px,6vw,80px)] w-[360px] max-w-full bg-panel animate-pulse mb-4" />
      <p className="font-mono text-[12px] tracking-[.2em] uppercase text-txt-3 mt-4">
        Loading championship…
      </p>
    </section>
  );
}
