import Link from 'next/link';

// Link colour set inline: globals.css has an unlayered `a { color: inherit }`,
// which beats Tailwind's text-* utilities on <a>/<Link>.
const LINK_ON_DARK = { color: '#fff' } as const;

// Shown beside the league story for visitors without a card of their own:
// why there isn't one, and the way to get it.
export function WrappedRecap({ reason }: { reason: 'signed-out' | 'no-card' | 'shared' }) {
  return (
    <div className="w-full max-w-[440px] rounded-[18px] bg-gold text-carbon px-6 py-6">
      {reason === 'signed-out' && (
        <>
          <p className="font-display font-black text-[26px] leading-[1.02]">
            Raced Season 19? Your own Wrapped is waiting.
          </p>
          <a
            href="/auth/login"
            className="inline-block mt-4 font-sans font-semibold text-[15px] bg-carbon rounded-full px-6 py-3 hover:bg-black"
            style={LINK_ON_DARK}
          >
            Sign in with Discord
          </a>
        </>
      )}
      {reason === 'no-card' && (
        <p className="font-sans text-[16px] leading-relaxed">
          Personal Wrapped is for drivers who raced the Season 19 GT3 Team Series. If you did, check that your Steam
          account is linked on your{' '}
          <Link href="/profile" className="underline font-semibold">
            profile
          </Link>
          .
        </p>
      )}
      {reason === 'shared' && (
        <>
          <p className="font-display font-black text-[26px] leading-[1.02]">Raced Season 19? Watch your own.</p>
          <Link
            href="/wrapped/s19"
            className="inline-block mt-4 font-sans font-semibold text-[15px] bg-carbon rounded-full px-6 py-3 hover:bg-black"
            style={LINK_ON_DARK}
          >
            Your Wrapped
          </Link>
        </>
      )}
    </div>
  );
}
