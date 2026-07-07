import { createSupabaseServerClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import SteamLinkForm from './SteamLinkForm';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const { data: driver } = await supabase
    .from('drivers')
    .select('display_name, avatar_url, steam_id, discord_id')
    .eq('user_id', user.id)
    .maybeSingle();

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">
        — Account
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-12">
        My Profile
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[900px]">
        {/* Discord identity */}
        <div className="border border-line bg-panel px-7 py-6">
          <p className="font-mono text-[11px] tracking-[.35em] uppercase text-gold mb-5">
            Discord Identity
          </p>
          <div className="flex items-center gap-4">
            {driver?.avatar_url ? (
              <Image
                src={driver.avatar_url}
                alt={driver.display_name ?? ''}
                width={56}
                height={56}
                className="rounded-full shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-panel-2 shrink-0" />
            )}
            <div>
              <p className="font-display font-bold text-[20px] uppercase text-txt">
                {driver?.display_name ?? user.email}
              </p>
              {driver?.discord_id && (
                <p className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 mt-1">
                  ID {driver.discord_id}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Steam identity */}
        <div className="border border-line bg-panel px-7 py-6">
          <p className="font-mono text-[11px] tracking-[.35em] uppercase text-gold mb-5">
            Steam Identity
          </p>
          {driver?.steam_id && (
            <div className="mb-4">
              <p className="font-mono text-[14px] text-txt">{driver.steam_id}</p>
              <p className="font-mono text-[10px] tracking-[.25em] uppercase text-txt-3 mt-1">
                Linked · used for race result matching
              </p>
            </div>
          )}
          <SteamLinkForm currentSteamId={driver?.steam_id ?? null} />
        </div>
      </div>

      <div className="mt-10 pt-10 border-t border-line max-w-[900px]">
        <form action="/auth/signout" method="POST">
          <button
            type="submit"
            className="font-mono text-[11px] tracking-[.15em] uppercase text-txt-3 hover:text-txt transition-colors"
          >
            Sign out
          </button>
        </form>
        <Link
          href="/"
          className="block mt-4 font-mono text-[11px] tracking-[.15em] uppercase text-txt-3 hover:text-gold transition-colors"
        >
          ← Back to home
        </Link>
      </div>
    </section>
  );
}
