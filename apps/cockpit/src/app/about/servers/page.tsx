import type { Metadata } from 'next';
import { ServerFleetBody } from './ServerFleetBody';

export const metadata: Metadata = {
  title: 'Server Info — SRA',
  description:
    'Live status of every Sim Racing Alliance race server across ACC and Assetto Corsa Evo — what is running, on which track, and who is on it.',
};

export default function ServersPage() {
  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-[140px] pb-24">
      <span className="block font-mono text-[11px] tracking-[.35em] uppercase text-gold-soft mb-3">
        — Live Now
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-4">
        Server Info
      </h1>
      <p className="font-sans text-[14px] text-txt-3 mb-14 max-w-[680px]">
        Every server SRA hosts, live. Search{' '}
        <span className="font-mono text-txt-2">SRA</span> in the in-game server browser to join.
        Refreshes about once a minute. You can find more server information in{' '}
        {/* Rendered as a Discord-style channel chip rather than a bare text
            link — "#server-info" is what you actually look for in the sidebar,
            and the pill makes it obvious this is something to click. */}
        <a
          href="https://discord.com/channels/915686674833498203/925126126555254825"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-[3px] align-baseline font-mono text-[13px] leading-none text-gold border border-gold/40 bg-gold/[.07] px-[7px] py-[3px] rounded-[3px] hover:text-gold-soft hover:border-gold/70 hover:bg-gold/15 transition-colors whitespace-nowrap"
        >
          <span aria-hidden="true">#</span>server-info
        </a>{' '}
        on our Discord.
      </p>

      <ServerFleetBody />
    </section>
  );
}
