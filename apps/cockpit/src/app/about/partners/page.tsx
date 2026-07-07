import Image from 'next/image';

export default function PartnersPage() {
  const featuredPartners = [
    {
      name: "Armamentario",
      logo: "https://static.simracingalliance.com/assets/images/partners/armamentario/ARMA-black.svg",
      href: "https://armamentario.com/",
      quote:
        "Armamentario is how ACC should have designed its HUD...",
    },
    {
      name: "Trak Racer",
      logo: "https://static.simracingalliance.com/assets/images/partners/trak-racer/logo.png",
      href: "https://trakracer.com/",
      quote:
        "I am incredibly happy with my Trak Racer TR80...",
    },
    {
      name: "GO Setups",
      logo: "https://static.simracingalliance.com/assets/images/partners/go-setups/GO_Setups_dark.png",
      href: "https://gosetups.gg/product/acc-setups/?ref=5879",
      quote:
        "Premium ACC setups built for competitive racing — used and trusted by SRA drivers.",
    },
  ];

  const additionalPartners = [
    { logo: "https://static.simracingalliance.com/assets/images/sliders/documize-com.png", href: "https://documize.com/" },
    { logo: "https://static.simracingalliance.com/assets/images/sliders/retro-saga-ca.png", href: null },
    { logo: "https://static.simracingalliance.com/assets/images/sliders/at3d-sim-shop.png", href: "https://at3d.net/" },
    { logo: "https://static.simracingalliance.com/assets/images/sliders/castlecauldron.png", href: "https://www.facebook.com/castlecauldron" },
    { logo: "https://static.simracingalliance.com/assets/images/sliders/kp_concepts.png", href: "https://www.kpconcepts.com/" },
    { logo: "https://static.simracingalliance.com/assets/images/sliders/echoes_of_nox.png", href: "https://store.steampowered.com/app/4368440/Echoes_of_Nox/" },
  ];

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">
        — About
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-10">
        Partners
      </h1>

      {/* Featured Partners */}
      <h2 className="font-display font-bold text-[28px] uppercase text-txt mt-16 mb-6">
        Featured Partners
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {featuredPartners.map((partner) => (
          <a
            key={partner.name}
            href={partner.href}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-line bg-panel p-6 flex flex-col hover:border-gold/40 transition-colors"
          >
            <div className="h-24 flex items-center justify-center mb-6">
              <Image
                src={partner.logo}
                alt={partner.name}
                width={200}
                height={96}
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <span className="font-display font-bold text-[20px] uppercase text-txt mb-3">
              {partner.name}
            </span>
            <p className="font-sans text-sm text-txt-2 leading-relaxed italic">
              &ldquo;{partner.quote}&rdquo;
            </p>
          </a>
        ))}
      </div>

      <div className="h-px bg-line my-12" />

      {/* Additional Partners */}
      <h2 className="font-display font-bold text-[28px] uppercase text-txt mt-16 mb-6">
        Additional Partners
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-6">
        {additionalPartners.map((partner) => {
          const inner = (
            <div className="border border-line bg-panel p-6 flex items-center justify-center aspect-square hover:border-gold/40 transition-colors">
              <Image
                src={partner.logo}
                alt=""
                width={120}
                height={120}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          );
          return partner.href ? (
            <a key={partner.logo} href={partner.href} target="_blank" rel="noopener noreferrer">
              {inner}
            </a>
          ) : (
            <div key={partner.logo}>{inner}</div>
          );
        })}
      </div>
    </section>
  );
}
