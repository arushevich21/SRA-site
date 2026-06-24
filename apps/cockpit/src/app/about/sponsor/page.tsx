export default function SponsorPage() {
  const tiers = [
    {
      name: "SRA Supporter",
      price: "$3",
      period: "/month",
      benefits: [
        "Support the league",
        "Exemption from driver number purges",
      ],
      link: "https://www.patreon.com/join/simracingalliance/checkout?rid=8967863",
    },
    {
      name: "SRA Sponsor",
      price: "$5",
      period: "/month",
      benefits: [
        "Everything in Supporter",
        "Shoutouts",
        "Sponsor polls",
        "Track selection input",
      ],
      link: "https://www.patreon.com/join/simracingalliance/checkout?rid=8967884",
    },
    {
      name: "Title Sponsor",
      price: "$10",
      period: "/month",
      benefits: [
        "Everything in Sponsor",
        "Sponsoring a hosted server",
      ],
      link: "https://www.patreon.com/join/simracingalliance/checkout?rid=8967898",
    },
  ];

  return (
    <section className="max-w-[1280px] mx-auto px-7 py-24">
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">
        — About
      </span>
      <h1 className="font-display font-black text-[clamp(40px,6vw,72px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-10">
        Sponsor
      </h1>

      {/* Patreon Tiers */}
      <h2 className="font-display font-bold text-[28px] uppercase text-txt mt-16 mb-6">
        Patreon Tiers
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className="border border-line bg-panel p-6 flex flex-col"
          >
            <span className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 mb-3">
              {tier.name}
            </span>
            <div className="mb-6">
              <span className="font-display text-[48px] text-gold leading-none">
                {tier.price}
              </span>
              <span className="font-sans text-sm text-txt-3 ml-1">
                {tier.period}
              </span>
            </div>
            <ul className="space-y-2 mb-8 flex-1">
              {tier.benefits.map((benefit) => (
                <li key={benefit} className="flex gap-3">
                  <span className="text-gold shrink-0">—</span>
                  <span className="font-sans text-sm text-txt-2 leading-relaxed">
                    {benefit}
                  </span>
                </li>
              ))}
            </ul>
            <a
              href={tier.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center border border-gold text-gold hover:text-gold-soft hover:border-gold-soft transition-colors font-mono text-[15px] tracking-[.2em] uppercase px-6 py-3"
            >
              Subscribe
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
