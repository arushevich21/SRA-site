export default function DonatePage() {
  const donationMethods = [
    {
      name: "PayPal",
      link: "https://paypal.me/TylerLaymon",
    },
    {
      name: "Cash App",
      link: "https://cash.app/$tylerslegacy",
    },
    {
      name: "Venmo",
      link: "https://venmo.com/code?user_id=1746733344227328083&created=1652718542.730074&printed=1",
    },
  ];

  return (
    <section className="max-w-[1280px] mx-auto px-7 py-24">
      <span className="block font-mono text-[11px] tracking-[.3em] uppercase text-gold mb-5">
        — About
      </span>
      <h1 className="font-display font-black text-[clamp(40px,6vw,72px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-10">
        Donate
      </h1>

      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-10 max-w-2xl">
        Donations help keep our servers running, and contribute to future
        development and improvements to our services.
      </p>

      {/* One-Time Donations */}
      <h2 className="font-display font-bold text-[28px] uppercase text-txt mt-16 mb-6">
        One-Time Donations
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
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
            <span className="font-mono text-[10px] tracking-[.2em] uppercase text-gold">
              Donate Now
            </span>
          </a>
        ))}
      </div>

      <div className="h-px bg-line my-12" />

      {/* Recurring Support */}
      <h2 className="font-display font-bold text-[28px] uppercase text-txt mt-16 mb-6">
        Recurring Support
      </h2>
      <div className="border border-line bg-panel p-6 max-w-xl">
        <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
          For recurring support, consider Discord Premium subscriptions or one of
          our Patreon tiers.
        </p>
        <a
          href="/about/sponsor"
          className="text-gold hover:text-gold-soft transition-colors font-mono text-[11px] tracking-[.2em] uppercase"
        >
          View Patreon Tiers →
        </a>
      </div>
    </section>
  );
}
