import { createSupabaseServerClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  verify_failed:
    'Steam could not verify that sign-in. Please try again.',
  already_linked:
    'That Steam account is already linked to a different SRA driver. Contact an admin in #admin-help if this is a mistake.',
  save_failed: 'Something went wrong saving your Steam link. Please try again.',
};

export default async function SteamLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  // Already verified? Nothing to do here.
  const { data: driver } = await supabase
    .from('drivers')
    .select('steam_verified')
    .eq('user_id', user.id)
    .maybeSingle();

  if (driver?.steam_verified) redirect('/');

  const { error } = await searchParams;
  const errorMsg = error ? ERRORS[error] : null;

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">
        — One more step
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-8">
        Verify your Steam
      </h1>

      <div className="max-w-[560px] border border-line bg-panel px-7 py-8">
        <p className="font-sans text-[15px] text-txt-2 leading-relaxed mb-6">
          SRA matches your race results by Steam account, so every driver has to
          confirm ownership of their Steam. You&apos;re signed in with Discord —
          this is the last step before you can use the site.
        </p>

        {errorMsg && (
          <p className="font-mono text-[12px] tracking-[.15em] uppercase text-red-400 mb-6">
            {errorMsg}
          </p>
        )}

        <Link href="/auth/steam/login" className="nav-signin inline-block">
          <span style={{ display: 'inline-block', transform: 'skewX(9deg)' }}>
            Sign In with Steam
          </span>
        </Link>

        <form action="/auth/signout" method="POST" className="mt-8">
          <button
            type="submit"
            className="font-mono text-[11px] tracking-[.15em] uppercase text-txt-3 hover:text-txt transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>
    </section>
  );
}
