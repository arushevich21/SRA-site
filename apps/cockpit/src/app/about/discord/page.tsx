export default function DiscordPage() {
  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">
        — About
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-10">
        Discord
      </h1>

      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-10 max-w-2xl">
        Join the Sim Racing Alliance community on Discord to find races, discuss
        strategy, and connect with fellow sim racers.
      </p>

      <a
        href="https://discord.gg/SimRacingAlliance"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block font-display font-bold text-[20px] uppercase bg-gold text-carbon px-8 py-4 hover:bg-gold-soft transition-colors"
        style={{ transform: 'skewX(-9deg)' }}
      >
        <span style={{ display: 'inline-block', transform: 'skewX(9deg)' }}>
          Join Our Discord &rarr;
        </span>
      </a>
    </section>
  );
}
