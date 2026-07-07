export default function LeagueInfoPage() {
  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">
        — About
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-10">
        League Info
      </h1>

      {/* Series descriptions (left) + Videos (right) */}
      <div className="flex gap-8 flex-col lg:flex-row mb-12">
        <div className="flex-1 min-w-0">
          <p className="font-sans text-sm text-txt-2 leading-relaxed mb-8">
            We are a North American PC-based sim racing league, and we strive to
            provide a competitive and clean racing environment. All session start
            times are Eastern time.
          </p>

          <h2 className="font-display font-bold text-[28px] uppercase text-txt mb-4">
            GT3 Team Series
          </h2>
          <p className="font-sans text-sm text-txt-2 leading-relaxed mb-8">
            The GT3 Team Series is the reason we play — competitive GT3 racing.
            Featuring 60-minute races across 4 divisions, teams consist of two
            drivers racing simultaneously. Divisions 1 and 3 race on Tuesdays,
            while Divisions 2 and 4 race on Wednesdays. Qualifying begins at 9:00
            PM EDT following a drivers briefing.
          </p>

          <h2 className="font-display font-bold text-[28px] uppercase text-txt mb-4">
            Multiclass Series on Le Mans Ultimate
          </h2>
          <p className="font-sans text-sm text-txt-2 leading-relaxed mb-8">
            Sprint races with multiple car classes on track simultaneously. No time
            or fuel requirements so run your own race. Scheduled Thursdays at 9:00
            PM EDT throughout the year.
          </p>

          <h2 className="font-display font-bold text-[28px] uppercase text-txt mb-4">
            Endurance Series
          </h2>
          <p className="font-sans text-sm text-txt-2 leading-relaxed mb-8">
            A grueling display of consistency and pace! Teams feature multiple
            drivers without division restrictions. Races range from 4 to 12 hours,
            scheduled on Saturday nights EDT throughout the year.
          </p>

          <h2 className="font-display font-bold text-[28px] uppercase text-txt mb-4">
            League in a Week
          </h2>
          <p className="font-sans text-sm text-txt-2 leading-relaxed">
            Different sprint races per night for 5 nights with drop races, scheduled
            between GT3 Team Series events.
          </p>
        </div>
        <div className="lg:w-[380px] shrink-0 flex flex-col gap-5">
          <div className="border border-line rounded-lg overflow-hidden">
            <iframe
              src="https://www.youtube.com/embed/q9kGNJ091dI"
              title="SRA Promo Video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full aspect-video"
            />
          </div>
          <div className="border border-line rounded-lg overflow-hidden">
            <iframe
              src="https://www.youtube.com/embed/fZPNbzuSMv4"
              title="GT3 Team Series Promo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full aspect-video"
            />
          </div>
          <div className="border border-line rounded-lg overflow-hidden">
            <iframe
              src="https://www.youtube.com/embed/h_ibdolJIiw"
              title="SRA Drivers Briefing"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full aspect-video"
            />
          </div>
        </div>
      </div>

      {/* Schedule Summary */}
      <h2 className="font-display font-bold text-[28px] uppercase text-txt mt-16 mb-6">
        Schedule
      </h2>
      <div className="bg-panel border border-line rounded-lg p-6 mb-8">
        <ul className="space-y-3">
          <li className="font-sans text-sm text-txt-2 leading-relaxed">
            <span className="font-mono text-[15px] tracking-[.15em] uppercase text-gold">
              Tuesdays
            </span>{" "}
            — GT3 Team Series Divisions 1 &amp; 3 &middot; 9:00 PM EDT
          </li>
          <li className="font-sans text-sm text-txt-2 leading-relaxed">
            <span className="font-mono text-[15px] tracking-[.15em] uppercase text-gold">
              Wednesdays
            </span>{" "}
            — GT3 Team Series Divisions 2 &amp; 4 &middot; 9:00 PM EDT
          </li>
          <li className="font-sans text-sm text-txt-2 leading-relaxed">
            <span className="font-mono text-[15px] tracking-[.15em] uppercase text-gold">
              Thursdays
            </span>{" "}
            — Multiclass on Le Mans Ultimate &middot; 9:00 PM EDT
          </li>
          <li className="font-sans text-sm text-txt-2 leading-relaxed">
            <span className="font-mono text-[15px] tracking-[.15em] uppercase text-gold">
              Saturdays
            </span>{" "}
            — Endurance Series &middot; EDT
          </li>
        </ul>
      </div>

      {/* Discord */}
      <h2 className="font-display font-bold text-[28px] uppercase text-txt mt-16 mb-6">
        Discord Community
      </h2>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Join our Discord server to stay up to date with announcements, find
        teammates, share setups, and connect with the SRA community.
      </p>
      <div className="bg-panel border border-line rounded-lg p-6 mb-8">
        <ul className="space-y-3">
          <li>
            <a
              href="https://discord.gg/SimRacingAlliance"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:text-gold-soft transition-colors"
            >
              Join the SRA Discord
            </a>
          </li>
          <li>
            <a
              href="https://discord.com/channels/915686674833498203/915686675575877735"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:text-gold-soft transition-colors"
            >
              #general-chat
            </a>
            <span className="font-sans text-sm text-txt-3 ml-2">
              — Main community hangout
            </span>
          </li>
          <li>
            <a
              href="https://discord.com/channels/915686674833498203/915694969321295882"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:text-gold-soft transition-colors"
            >
              #simrig-showcase
            </a>
            <span className="font-sans text-sm text-txt-3 ml-2">
              — Show off your sim racing setup
            </span>
          </li>
          <li>
            <a
              href="https://discord.com/channels/915686674833498203/915695119074725888"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:text-gold-soft transition-colors"
            >
              #real-life-rides
            </a>
            <span className="font-sans text-sm text-txt-3 ml-2">
              — Share your real-world cars
            </span>
          </li>
          <li>
            <a
              href="https://discord.com/channels/915686674833498203/1099843168847016039"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:text-gold-soft transition-colors"
            >
              #setup-bot
            </a>
            <span className="font-sans text-sm text-txt-3 ml-2">
              — Car setup sharing and discussion
            </span>
          </li>
          <li>
            <a
              href="https://discord.com/channels/915686674833498203/918620901929533500"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:text-gold-soft transition-colors"
            >
              #graphics-liveries
            </a>
            <span className="font-sans text-sm text-txt-3 ml-2">
              — Custom liveries and graphic design
            </span>
          </li>
          <li>
            <a
              href="https://discord.com/channels/915686674833498203/918662645823979540"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:text-gold-soft transition-colors"
            >
              #youtube
            </a>
            <span className="font-sans text-sm text-txt-3 ml-2">
              — SRA YouTube content
            </span>
          </li>
          <li>
            <a
              href="https://discord.com/channels/915686674833498203/919054945167216651"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:text-gold-soft transition-colors"
            >
              #twitch
            </a>
            <span className="font-sans text-sm text-txt-3 ml-2">
              — Live streams and broadcasts
            </span>
          </li>
          <li>
            <a
              href="https://discord.com/channels/915686674833498203/1012438472189026404"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:text-gold-soft transition-colors"
            >
              #admin-help
            </a>
            <span className="font-sans text-sm text-txt-3 ml-2">
              — Reach out for league support
            </span>
          </li>
        </ul>
      </div>
    </section>
  );
}
