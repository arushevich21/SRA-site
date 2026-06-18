export default function ChampionshipsLoading() {
  return (
    <section className="max-w-[1280px] mx-auto px-7 py-24">
      <span className="block font-mono text-[11px] tracking-[.3em] uppercase text-gold mb-5">
        — Championships
      </span>
      <div className="h-[clamp(52px,7vw,96px)] w-[360px] max-w-full bg-panel animate-pulse mb-4" />
      <p className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 mt-4">
        Loading championship…
      </p>
    </section>
  );
}
