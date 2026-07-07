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

  const donationMethods = [
    { name: "PayPal", link: "https://paypal.me/TylerLaymon" },
    { name: "Cash App", link: "https://cash.app/$tylerslegacy" },
    { name: "Venmo", link: "https://venmo.com/code?user_id=1746733344227328083&created=1652718542.730074&printed=1" },
  ];

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">
        — About
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-10">
        Support SRA
      </h1>

      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-10 max-w-2xl">
        Donations and sponsorships help keep our servers running, and contribute
        to future development and improvements to our services.
      </p>

      {/* Patreon Tiers */}
      <h2 className="font-display font-bold text-[28px] uppercase text-txt mb-6">
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

      {/* Divider */}
      <div className="flex items-center gap-4 my-14">
        <div className="flex-1 h-px bg-line" />
        <span className="font-mono text-[11px] tracking-[.4em] uppercase text-txt-3 shrink-0">
          One-Time Donations
        </span>
        <div className="flex-1 h-px bg-line" />
      </div>

      {/* One-Time Donations */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {donationMethods.map((method) => (
          <a
            key={method.name}
            href={method.link}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-line bg-panel p-6 flex flex-col items-center text-center hover:border-gold transition-colors"
          >
            <span className="font-display font-bold text-[20px] uppercase text-txt mb-2">
              {method.name}
            </span>
            <span className="font-mono text-[15px] tracking-[.2em] uppercase text-gold">
              Donate Now
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
