import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabase as adminClient } from '@/lib/supabase';
import { verifyAssertion } from '@/lib/steam-openid';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  // Must still be the same signed-in Discord user we started the flow as.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.redirect(`${origin}/auth/login`);

  // Prove the assertion really came from Steam and pull the verified SteamID64.
  const steamId = await verifyAssertion(searchParams);

  if (!steamId) {
    console.error('[auth/steam/callback] Steam assertion failed verification');
    return NextResponse.redirect(`${origin}/auth/steam/link?error=verify_failed`);
  }

  // Write the verified id onto the caller's own driver row. Service-role: the
  // row may not exist yet for brand-new users, and we set steam_verified which
  // RLS drivers_update_own would allow but service-role keeps it uniform.
  const { error } = await adminClient
    .from('drivers')
    .update({ steam_id: steamId, steam_verified: true })
    .eq('user_id', user.id);

  if (error) {
    // 23505 = unique_violation: this SteamID is already linked to a different
    // driver row (data conflict — e.g. seeded onto the wrong Discord account).
    if (error.code === '23505') {
      console.error(
        '[auth/steam/callback] steam_id already linked to another driver:',
        steamId,
      );
      return NextResponse.redirect(
        `${origin}/auth/steam/link?error=already_linked`,
      );
    }
    console.error('[auth/steam/callback] update failed:', error.message);
    return NextResponse.redirect(`${origin}/auth/steam/link?error=save_failed`);
  }

  return NextResponse.redirect(origin);
}
