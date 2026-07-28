import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabase as adminClient } from '@/lib/supabase';
import { computeDriverDisplayName } from '@/lib/driver-display-name';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error('[auth/callback] session exchange failed:', error?.message);
    return NextResponse.redirect(`${origin}/?error=auth_failed`);
  }

  const user = data.session.user;

  // Extract Discord identity — Supabase Auth surfaces it in identities[]
  const discordIdentity = user.identities?.find((i) => i.provider === 'discord');
  const discordId =
    (discordIdentity?.identity_data?.sub as string | undefined) ??
    (discordIdentity?.identity_data?.provider_id as string | undefined) ??
    (user.user_metadata?.provider_id as string | undefined);

  // Prefer Discord's global_name (display name) over username.
  // Supabase sometimes maps full_name to the username when global_name is absent.
  const displayName =
    (discordIdentity?.identity_data?.global_name as string | undefined) ??
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    'Unknown';

  const avatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ?? null;

  if (discordId) {
    // Check for an existing row (seeded or prior sign-in) — pull the fields
    // computeDriverDisplayName needs so a re-login recomputes from the
    // driver's own structured name/number/champion status instead of
    // blindly overwriting with Discord's raw name (which used to wipe out
    // the "┊<number>" suffix and the champion's #1 on every sign-in).
    const { data: existing } = await adminClient
      .from('drivers')
      .select('id, first_name, last_name, driver_number, is_champion')
      .eq('discord_id', discordId)
      .maybeSingle();

    if (existing) {
      // Claim the seeded row: attach user_id, refresh avatar, recompute
      // display name from the driver's own profile data (Discord's name is
      // only the fallback for a driver who hasn't filled out first/last name
      // yet). Does NOT touch steam_id — preserves pre-seeded value.
      const { error: updateErr } = await adminClient
        .from('drivers')
        .update({
          user_id: user.id,
          display_name: computeDriverDisplayName({
            firstName: existing.first_name,
            lastName: existing.last_name,
            driverNumber: existing.driver_number,
            isChampion: existing.is_champion ?? false,
            fallback: displayName,
          }),
          avatar_url: avatarUrl,
        })
        .eq('discord_id', discordId);

      if (updateErr) {
        console.error('[auth/callback] claim update failed:', updateErr.message);
      }
    } else {
      // Newcomer: create a fresh driver row (no steam_id yet)
      const { error: insertErr } = await adminClient
        .from('drivers')
        .insert({
          user_id: user.id,
          discord_id: discordId,
          display_name: displayName,
          avatar_url: avatarUrl,
        });

      if (insertErr) {
        console.error('[auth/callback] newcomer insert failed:', insertErr.message);
      }
    }
  } else {
    console.warn('[auth/callback] no discord_id found in session for user', user.id);
  }

  return NextResponse.redirect(origin);
}
