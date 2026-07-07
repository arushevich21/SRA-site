export default function DriversPage() {
  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">
        — About
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-10">
        Drivers &amp; Stats
      </h1>

      {/* Overall Stats */}
      <h2 className="font-display font-bold text-[28px] uppercase text-txt mt-16 mb-6">
        Overall
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
        <div className="border border-line bg-panel p-6">
          <span className="font-display text-[48px] text-gold leading-none">
            655
          </span>
          <span className="block font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 mt-2">
            Active Drivers
          </span>
        </div>
        <div className="border border-line bg-panel p-6">
          <span className="font-display text-[48px] text-gold leading-none">
            999
          </span>
          <span className="block font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 mt-2">
            Available Numbers
          </span>
        </div>
        <div className="border border-line bg-panel p-6">
          <span className="font-display text-[48px] text-gold leading-none">
            66%
          </span>
          <span className="block font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 mt-2">
            Number Utilization
          </span>
        </div>
      </div>

      <div className="h-px bg-line my-12" />

      {/* Geographic Breakdown */}
      <h2 className="font-display font-bold text-[28px] uppercase text-txt mt-16 mb-6">
        Geographic Breakdown
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">
        {[
          { country: "United States", count: 357, pct: "54.5%" },
          { country: "Canada", count: 97, pct: "14.8%" },
          { country: "Colombia", count: 22, pct: "3.4%" },
          { country: "Brazil", count: 20, pct: "3.1%" },
          { country: "United Kingdom", count: 18, pct: "2.7%" },
        ].map((g) => (
          <div key={g.country} className="border border-line bg-panel p-6">
            <span className="font-display text-[28px] text-gold leading-none">
              {g.count}
            </span>
            <span className="block font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 mt-2">
              {g.country}
            </span>
            <span className="block font-sans text-sm text-txt-2 mt-1">
              {g.pct}
            </span>
          </div>
        ))}
        <div className="border border-line bg-panel p-6 flex items-center justify-center">
          <span className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 text-center">
            + 52 other countries
          </span>
        </div>
      </div>

      <div className="h-px bg-line my-12" />

      {/* Division Breakdown */}
      <h2 className="font-display font-bold text-[28px] uppercase text-txt mt-16 mb-6">
        Division Breakdown
      </h2>
      <div className="border border-line bg-panel rounded-lg overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-line">
              <th className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 px-6 py-4">
                Division
              </th>
              <th className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 px-6 py-4">
                Total
              </th>
              <th className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 px-6 py-4">
                Gold
              </th>
              <th className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 px-6 py-4">
                Silver
              </th>
            </tr>
          </thead>
          <tbody>
            {[
              { div: "D1", total: 45, gold: 23, silver: 22 },
              { div: "D2", total: 57, gold: 24, silver: 33 },
              { div: "D3", total: 50, gold: 23, silver: 27 },
              { div: "D4", total: 39, gold: 20, silver: 19 },
            ].map((row) => (
              <tr key={row.div} className="border-b border-line last:border-0">
                <td className="font-sans text-sm text-txt px-6 py-4 font-semibold">
                  {row.div}
                </td>
                <td className="font-sans text-sm text-txt-2 px-6 py-4">
                  {row.total}
                </td>
                <td className="font-sans text-sm text-gold px-6 py-4">
                  {row.gold}
                </td>
                <td className="font-sans text-sm text-txt-2 px-6 py-4">
                  {row.silver}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="h-px bg-line my-12" />

      {/* SRAlien Note */}
      <div className="border border-line bg-panel p-6">
        <span className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 mb-2 block">
          Classification Note
        </span>
        <p className="font-sans text-sm text-txt-2 leading-relaxed">
          SRAlien classification for elite performers (ratings 99+).
        </p>
      </div>
    </section>
  );
}
