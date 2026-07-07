import { LEADERBOARDS } from '../../../content/stats-leaderboards';
import { StatsLeaderboard } from '../../../components/StatsLeaderboard';

export default function StatsPage() {
  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">
        — About
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-10">
        Statistics
      </h1>

      {/* Platform Metrics */}
      <h2 className="font-display font-bold text-[28px] uppercase text-txt mt-16 mb-6">
        Platform Metrics
      </h2>
      <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 mb-6">
        Since December 27, 2021
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {[
          { value: "4,540,616", label: "Total Laps" },
          { value: "94,327", label: "Total Sessions" },
          { value: "17,835", label: "Active Drivers" },
          { value: "22,393,247", label: "Kilometers Driven" },
        ].map((stat) => (
          <div key={stat.label} className="border border-line bg-panel p-6">
            <span className="font-display text-[48px] text-gold leading-none">
              {stat.value}
            </span>
            <span className="block font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 mt-2">
              {stat.label}
            </span>
          </div>
        ))}
      </div>

      <div className="h-px bg-line my-12" />

      {/* Leaderboards */}
      <h2 className="font-display font-bold text-[28px] uppercase text-txt mt-16 mb-6">
        Leaderboards
      </h2>
      <StatsLeaderboard categories={LEADERBOARDS} />

      <div className="h-px bg-line my-12" />

      {/* Footer Note */}
      <div className="border border-line bg-panel p-6">
        <span className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 mb-2 block">
          Data Note
        </span>
        <p className="font-sans text-sm text-txt-2 leading-relaxed">
          All statistics generated daily using data from main and time trial
          servers.
        </p>
      </div>
    </section>
  );
}
