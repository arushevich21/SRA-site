import Link from 'next/link';
import type { WrappedSummary } from '@/lib/wrapped/snapshot';

// Link colour set inline: globals.css has an unlayered `a { color: inherit }`,
// which beats Tailwind's text-* utilities on <a>/<Link>.
const LINK_ON_DARK = { color: '#fff' } as const;

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

// The league's season in one gold block, for visitors without a card of
// their own (signed out, or didn't race the series) and under a shared one.
export function WrappedRecap({
  summary,
  reason,
}: {
  summary: WrappedSummary | null;
  reason: 'signed-out' | 'no-card' | 'shared';
}) {
  return (
    <div className="w-full max-w-[640px] rounded-[18px] bg-gold text-carbon px-7 py-9 sm:px-10">
      <h1 className="font-display font-black text-[clamp(40px,8vw,64px)] leading-[.92] tracking-[-1px]">
        Season 19, wrapped.
      </h1>
      {summary && (
        <p className="font-sans text-[18px] leading-relaxed mt-5 max-w-[46ch]">
          {fmt(summary.drivers)} drivers raced {fmt(summary.races)} times across four divisions of
          the GT3 Team Series: {fmt(summary.laps)} laps, {fmt(summary.km)} km, {fmt(summary.hours)}{' '}
          hours on track.
          {summary.sweatiest &&
            ` The sweatiest of them all, ${summary.sweatiest.name}, ran ${fmt(summary.sweatiest.laps)} hot laps.`}
        </p>
      )}
      <div className="mt-8">
        {reason === 'signed-out' && (
          <>
            <p className="font-sans text-[16px] mb-4">
              Raced this season? Sign in to watch your own.
            </p>
            <a
              href="/auth/login"
              className="inline-block font-sans font-semibold text-[15px] bg-carbon text-white rounded-full px-6 py-3 hover:bg-black"
              style={LINK_ON_DARK}
            >
              Sign in with Discord
            </a>
          </>
        )}
        {reason === 'no-card' && (
          <p className="font-sans text-[16px]">
            Wrapped is for drivers who raced the Season 19 GT3 Team Series. If you did, check that
            your Steam account is linked on your{' '}
            <Link href="/profile" className="underline font-semibold">
              profile
            </Link>
            .
          </p>
        )}
        {reason === 'shared' && (
          <Link
            href="/wrapped/s19"
            className="inline-block font-sans font-semibold text-[15px] bg-carbon text-white rounded-full px-6 py-3 hover:bg-black"
            style={LINK_ON_DARK}
          >
            Watch your own
          </Link>
        )}
      </div>
    </div>
  );
}
