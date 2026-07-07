import { Fragment } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const STATS = [
  { value: '18', label: 'Seasons' },
  { value: '3,400+', label: 'Members' },
  { value: '4', label: 'Divisions' },
  { value: '38', label: 'ACC Servers' },
  { value: '94,327', label: 'Sessions' },
  { value: '4,540,616', label: 'Laps' },
];

const FEATURES: {
  heading: string;
  body: string;
  image: string;
  imageRight: boolean;
  ctas: { label: string; href: string; external?: boolean }[];
}[] = [
  {
    heading: 'GT3 Team Series',
    body: 'The reason we play sim racing — competitive GT3 racing. This is our main series featuring 60 minute races split into 4 divisions. This is a team and drivers\' series; teams are made up of two drivers both racing on track at the same time. No matter your pace, you will find on-track battles for position throughout your respective split!',
    image: 'https://static.simracingalliance.com/assets/images/gt3_team_series_clip_1.gif',
    imageRight: true,
    ctas: [{ label: 'View All Championships', href: '/championships' }],
  },
  {
    heading: 'Leaderboards',
    body: 'All time and seasonal hot lap / hot stint leaderboards to track all of your laps! We have 38 ACC servers online 24/7 for every ACC track available, allowing you to set your best lap times whenever you like. You can also compare lap times with your friends and division rivals!',
    image: 'https://static.simracingalliance.com/assets/images/leaderboards_clip_1.gif',
    imageRight: false,
    ctas: [{ label: 'View All Leaderboards', href: '/leaderboards' }],
  },
  {
    heading: 'SRAting Driver Rating',
    body: 'SRAting is a weighted combination of three separate metrics: pace, performance, and safety. It is a data-driven approach to quantifying the overall strength of each member as a racing driver. It is a tool to quantify each driver\'s racing potential to help delineate divisions for our GT3 Team Series.',
    image: 'https://static.simracingalliance.com/assets/images/SRAting_clip_1.gif',
    imageRight: true,
    ctas: [{ label: 'View SRAting', href: '/about/srating' }],
  },
  {
    heading: 'Live Streaming',
    body: 'We live stream our main events to Twitch and YouTube for our entire community to enjoy! Live chat with your fellow community members, request driver focus on stream or participate in live polls. Check out our live stream for our next event or watch any of our past events anytime!',
    image: 'https://static.simracingalliance.com/assets/images/live_streaming_clip_1.gif',
    imageRight: false,
    ctas: [
      { label: 'SRA Twitch', href: 'https://www.twitch.tv/sim_racing_alliance', external: true },
      { label: 'SRA YouTube', href: 'https://youtube.com/channel/UCiDAEhPJIO6Zj1jP0cPFJqA', external: true },
    ],
  },
  {
    heading: 'Discord Community',
    body: 'We have an active and supportive community of 3,400+ members where you can get help with your sim racing experience. Discuss car setup tips, get help with car liveries or PC/simrig hardware, view race clips & highlights, check out member live streams or just have fun chatting with your fellow SRA members.',
    image: 'https://static.simracingalliance.com/assets/images/Discord_slide_1.png',
    imageRight: true,
    ctas: [{ label: 'Join Our Discord', href: 'https://discord.gg/SimRacingAlliance', external: true }],
  },
];

const PARTNERS = [
  { logo: 'https://static.simracingalliance.com/assets/images/sliders/armamentario-com.png', href: 'https://www.armamentario.com' },
  { logo: 'https://static.simracingalliance.com/assets/images/sliders/go-setups.png', href: 'https://gosetups.gg/product/acc-setups/?ref=5879' },
  { logo: 'https://static.simracingalliance.com/assets/images/sliders/trak-racer.png', href: 'https://trakracer.com' },
  { logo: 'https://static.simracingalliance.com/assets/images/sliders/documize-com.png', href: 'https://documize.com' },
  { logo: 'https://static.simracingalliance.com/assets/images/sliders/retro-saga-ca.png', href: 'https://retrosaga.ca' },
  { logo: 'https://static.simracingalliance.com/assets/images/sliders/at3d-sim-shop.png', href: 'https://at3d.net' },
  { logo: 'https://static.simracingalliance.com/assets/images/sliders/castlecauldron.png', href: 'https://facebook.com/castlecauldron' },
  { logo: 'https://static.simracingalliance.com/assets/images/sliders/kp_concepts.png', href: 'https://www.kpconcepts.com' },
  { logo: 'https://static.simracingalliance.com/assets/images/sliders/echoes_of_nox.png', href: 'https://store.steampowered.com/app/4368440/Echoes_of_Nox/' },
];

export function HomePageLegacy() {
  return (
    <>
      {/* HERO */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-7 pt-[76px] pb-16 overflow-hidden">
        <div
          className="absolute top-0 right-[-10%] w-[46%] h-full z-0"
          style={{
            background: 'linear-gradient(115deg, transparent 0%, rgba(230,181,61,.07) 45%, rgba(230,181,61,.13) 50%, transparent 51%)',
            transform: 'skewX(-12deg)',
          }}
        />

        <div className="relative z-10 max-w-[800px] text-center">
          <Image
            src="/badges/GT3TSAsset_white.png"
            alt="Sim Racing Alliance"
            width={160}
            height={160}
            className="mx-auto mb-10 w-[120px] h-auto"
            priority
          />

          <h1 className="font-display font-black text-[clamp(36px,5.5vw,64px)] uppercase leading-[.95] tracking-[-1px] text-txt">
            We are <span className="shake text-gold">excited</span> to have
            you be a part of our league!
          </h1>

          <p className="font-sans text-[16px] text-txt-2 leading-relaxed mt-6 max-w-[600px] mx-auto">
            We are a North American PC-based ACC · LMU · AC Evo sim racing
            league, and we strive to provide a competitive and clean racing
            environment. Let&apos;s get you set up to start racing and plugged
            into the community right away!
          </p>

          <div className="mt-8">
            <Link
              href="/about/league-info"
              className="inline-block font-sans font-bold text-[13.5px] tracking-[.09em] uppercase bg-gold text-carbon px-7 py-4 hover:bg-gold-soft hover:shadow-[0_0_30px_rgba(230,181,61,.45)] transition-all"
              style={{ transform: 'skewX(-9deg)' }}
            >
              <span style={{ display: 'inline-block', transform: 'skewX(9deg)' }}>
                Get Started →
              </span>
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-12">
            {STATS.map((stat, i) => (
              <Fragment key={stat.label}>
                {i > 0 && (
                  <span className="text-gold/30 hidden sm:block select-none">·</span>
                )}
                <span className="font-mono text-[12px] tracking-[.2em] uppercase text-txt-3">
                  <span className="text-gold">{stat.value}</span> {stat.label}
                </span>
              </Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURE SECTIONS */}
      {FEATURES.map((feat, i) => (
        <section key={feat.heading} className="relative border-t border-line">
          <div className="max-w-[1280px] mx-auto px-7 py-24">
            <div
              className={[
                'flex gap-12 items-center flex-col',
                feat.imageRight ? 'lg:flex-row' : 'lg:flex-row-reverse',
              ].join(' ')}
            >
              <div className="flex-1 min-w-0">
                <span className="font-mono text-[11px] tracking-[.35em] uppercase text-txt-3 mb-4 block">
                  0{i + 1}
                </span>
                <h2 className="font-display font-black text-[clamp(32px,4.4vw,56px)] uppercase leading-[.92] tracking-[-0.5px] text-txt mb-5">
                  {feat.heading}
                </h2>
                <p className="font-sans text-[15px] text-txt-2 leading-relaxed max-w-[500px]">
                  {feat.body}
                </p>
                <div className="flex gap-3 mt-8 flex-wrap">
                  {feat.ctas.map((cta) =>
                    cta.external ? (
                      <a
                        key={cta.label}
                        href={cta.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[12px] tracking-[.15em] uppercase text-gold border border-line-2 px-5 py-3 hover:border-gold hover:text-gold-soft transition-colors"
                      >
                        {cta.label} →
                      </a>
                    ) : (
                      <Link
                        key={cta.label}
                        href={cta.href}
                        className="font-mono text-[12px] tracking-[.15em] uppercase text-gold border border-line-2 px-5 py-3 hover:border-gold hover:text-gold-soft transition-colors"
                      >
                        {cta.label} →
                      </Link>
                    ),
                  )}
                </div>
              </div>

              <div className="lg:w-[520px] shrink-0">
                <div className="border border-line overflow-hidden">
                  <Image
                    src={feat.image}
                    alt={feat.heading}
                    width={520}
                    height={293}
                    className="w-full h-auto"
                    priority={i === 0}
                    unoptimized
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* PARTNERS STRIP */}
      <section className="border-t border-b border-line py-10 overflow-hidden">
        <div className="max-w-[1280px] mx-auto px-7">
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-6 items-center">
            {PARTNERS.map((p) => (
              <a
                key={p.href}
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center p-3 opacity-50 hover:opacity-100 transition-opacity"
              >
                <Image
                  src={p.logo}
                  alt=""
                  width={120}
                  height={40}
                  className="max-h-[40px] max-w-full object-contain"
                  unoptimized
                />
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
