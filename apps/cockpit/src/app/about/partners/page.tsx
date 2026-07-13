import Image from 'next/image';

export default function PartnersPage() {
  const featuredPartners = [
    {
      name: "Trackside Hospitality",
      logo: "/sponsors/sliders/TS_Logo_White_SVG.png",
      href: "https://trackside.vip",
      description:
        "Curated race-weekend packages bundling travel, hospitality, and exclusive motorsport access.",
    },
    {
      name: "KP Concepts",
      logo: "/sponsors/sliders/kp_concepts.png",
      href: "https://www.kpconcepts.com/",
      description:
        "Custom vehicle renderings, graphic design, and photography/videography services.",
    },
    {
      name: "Triple Stint",
      logo: "/sponsors/partners/triple-stint/White%20Text/Logo.png",
      href: "https://triplestintracing.com/",
      description: "High-quality racing gloves built for sim racers.",
    },
  ];

  const communityPartners = [
    {
      name: "Armamentario",
      logo: "/sponsors/partners/armamentario/ARMA-white.png",
      href: "https://armamentario.com/",
      description:
        "An all-in-one toolbox for ACC — setup management, overlays, and streaming tools.",
    },
    {
      name: "Trak Racer",
      logo: "/sponsors/partners/trak-racer/logo-new.png",
      href: "https://trakracer.com/",
      description: "Sim racing rigs and cockpit hardware for enthusiasts and pros.",
    },
    {
      name: "GO Setups",
      logo: "/sponsors/sliders/go-setups.png",
      href: "https://gosetups.gg/product/acc-setups/?ref=5879",
      description:
        "Pro-built race setups plus an overlay and data-comparison app for iRacing, ACC, and more.",
    },
  ];

  const additionalPartners = [
    { logo: "/sponsors/sliders/documize-com.png", href: "https://documize.com/" },
    { logo: "/sponsors/sliders/retro-saga-ca.png", href: null },
    { logo: "/sponsors/sliders/at3d-sim-shop.png", href: "https://at3d.net/" },
    { logo: "/sponsors/sliders/castlecauldron.png", href: "https://www.facebook.com/castlecauldron" },
    { logo: "/sponsors/sliders/echoes_of_nox.png", href: "https://store.steampowered.com/app/4368440/Echoes_of_Nox/" },
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
            <div className="h-32 flex items-center justify-center mb-6">
              <Image
                src={partner.logo}
                alt={partner.name}
                width={200}
                height={128}
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <span className="font-display font-bold text-[20px] uppercase text-txt mb-3">
              {partner.name}
            </span>
            <p className="font-sans text-sm text-txt-2 leading-relaxed">
              {partner.description}
            </p>
          </a>
        ))}
      </div>

      <div className="h-px bg-line my-12" />

      {/* Community Partners */}
      <h2 className="font-display font-bold text-[28px] uppercase text-txt mt-16 mb-6">
        Community Partners
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {communityPartners.map((partner) => (
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
            <p className="font-sans text-sm text-txt-2 leading-relaxed">
              {partner.description}
            </p>
          </a>
        ))}
      </div>

      <div className="h-px bg-line my-12" />

      {/* Additional Partners */}
      <h2 className="font-display font-bold text-[28px] uppercase text-txt mt-16 mb-6">
        Additional Partners
      </h2>
      <div className="flex flex-wrap justify-center gap-6">
        {additionalPartners.map((partner) => {
          const inner = (
            <div className="w-[120px] sm:w-[130px] border border-line bg-panel p-6 flex items-center justify-center aspect-square hover:border-gold/40 transition-colors">
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
