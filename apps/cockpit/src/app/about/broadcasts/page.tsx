import type { Metadata } from 'next';
import { getLatestYouTubeBroadcasts } from '@/lib/broadcasts';

export const revalidate = 1800;

export const metadata: Metadata = {
  title: 'Broadcasts — Sim Racing Alliance',
  description:
    'Watch live race broadcasts, highlights, and full event replays on the official Sim Racing Alliance YouTube and Twitch channels.',
};

interface BroadcastChannel {
  name: string;
  platform: 'YouTube' | 'Twitch';
  handle: string;
  url: string;
  description: string;
  accent: string;
  badge: string;
}

const CHANNELS: BroadcastChannel[] = [
  {
    name: 'Sim Racing Alliance on YouTube',
    platform: 'YouTube',
    handle: '@SimRacingAlliance',
    url: 'https://www.youtube.com/@SimRacingAlliance',
    description:
      'Home of official live race streams across all divisions, championship trailers, drivers briefings, highlights, and full race replay archives.',
    accent: '#FF0000',
    badge: 'All Divisions Live + Archives',
  },
  {
    name: 'Sim Racing Alliance on Twitch',
    platform: 'Twitch',
    handle: 'SimRacingAlliance',
    url: 'https://www.twitch.tv/SimRacingAlliance',
    description:
      'Catch high-stakes racing action live every race week, featuring live commentary, chat interaction, and driver interviews.',
    accent: '#9146FF',
    badge: 'Live Broadcasts',
  },
];

export default async function BroadcastsPage() {
  const recentBroadcasts = await getLatestYouTubeBroadcasts(2);

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      {/* Header */}
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">
        — About
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-6">
        Broadcasts
      </h1>
      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-12 max-w-2xl">
        Watch live racing action, commentary, and full event archives. Follow our
        official streaming channels on YouTube and Twitch to never miss a race night.
      </p>

      {/* Streaming Channels */}
      <h2 className="font-display font-bold text-[28px] uppercase text-txt mb-6">
        Official Streaming Channels
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
        {CHANNELS.map((channel) => (
          <div
            key={channel.platform}
            className="border border-line bg-panel p-6 sm:p-8 flex flex-col justify-between hover:border-gold/40 transition-colors"
          >
            <div>
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  {channel.platform === 'YouTube' ? (
                    <svg
                      className="w-7 h-7 shrink-0 text-[#FF0000]"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                  ) : (
                    <svg
                      className="w-7 h-7 shrink-0 text-[#9146FF]"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
                    </svg>
                  )}
                  <span className="font-display font-bold text-xl uppercase text-txt">
                    {channel.platform}
                  </span>
                </div>
                <span className="font-mono text-[11px] uppercase tracking-wider px-2.5 py-1 bg-carbon-2 border border-line text-txt-3">
                  {channel.badge}
                </span>
              </div>

              <span className="block font-mono text-xs text-gold mb-3">
                {channel.handle}
              </span>

              <p className="font-sans text-sm text-txt-2 leading-relaxed mb-6">
                {channel.description}
              </p>
            </div>

            <a
              href={channel.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center border border-gold text-gold hover:text-gold-soft hover:border-gold-soft transition-colors font-mono text-[13px] tracking-[.15em] uppercase px-5 py-3 text-center"
            >
              Visit {channel.platform} Channel →
            </a>
          </div>
        ))}
      </div>

      {/* Embedded Broadcast Previews */}
      <div className="flex items-center gap-4 mb-8">
        <h2 className="font-display font-bold text-[28px] uppercase text-txt shrink-0">
          Recent Broadcasts
        </h2>
        <div className="flex-1 h-px bg-line" />
      </div>

      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-8 max-w-2xl">
        Catch up on the latest race streams below or jump directly to full recordings on our channel.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {recentBroadcasts.map((broadcast) => (
          <div
            key={broadcast.id}
            className="border border-line bg-panel overflow-hidden flex flex-col group hover:border-gold/40 transition-colors"
          >
            {/* 16:9 Video Embed Container */}
            <div className="relative w-full aspect-video bg-carbon-2 border-b border-line">
              <iframe
                src={broadcast.embedUrl}
                title={broadcast.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="absolute inset-0 w-full h-full border-0"
              />
            </div>

            {/* Content & Details */}
            <div className="p-6 flex flex-col flex-1 justify-between">
              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-gold">
                    {broadcast.formattedDate}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-txt-3">
                    {broadcast.platform}
                  </span>
                </div>

                <h3 className="font-display font-bold text-lg uppercase text-txt mb-2">
                  {broadcast.title}
                </h3>

                <p className="font-sans text-sm text-txt-2 leading-relaxed mb-6">
                  {broadcast.description}
                </p>
              </div>

              <a
                href={broadcast.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-txt-3 hover:text-gold transition-colors"
              >
                Watch on {broadcast.platform}
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
