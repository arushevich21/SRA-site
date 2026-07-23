'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabase as adminClient } from '@/lib/supabase';
import { getChampionships } from '@/lib/championships-store';

export type RegisterState = { error: string } | { success: true } | null;

export async function registerTeam(
  _prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be signed in to register' };

  // ── 2. Resolve championship from content layer ─────────────────────────────
  // Client sends the key; config (maxTeamSize, allowedCars, season) comes from
  // the server-side content layer, never from the client.
  const champKey = formData.get('championship_key') as string | null;
  const champ = (await getChampionships()).find((c) => c.registrationKey === champKey);
  if (!champ?.registrationOpen) {
    return { error: 'Registration is not open for this championship' };
  }
  if (!champ.registrationSeason || !champ.maxTeamSize || !champ.allowedCars) {
    return { error: 'Championship configuration error — contact an admin' };
  }
  const simSlug = (formData.get('sim_slug') as string | null) ?? 'acc';

  // ── 3. Registrant's driver record — division_id is SERVER-DERIVED ──────────
  const { data: driver } = await adminClient
    .from('drivers')
    .select('id, division_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!driver) return { error: 'Driver record not found — contact an admin' };
  if (!driver.division_id) {
    return {
      error:
        'You need a division assigned before registering — contact an admin',
    };
  }

  // ── 4. Validate form inputs ────────────────────────────────────────────────
  const teamName = (formData.get('team_name') as string | null)?.trim();
  const car = formData.get('car') as string | null;

  if (!teamName) return { error: 'Team name is required' };
  if (!car || !champ.allowedCars.includes(car)) {
    return { error: 'Invalid car selection' };
  }

  // Deduplicate and cap teammate IDs
  const rawTeammates = formData.getAll('teammate_id') as string[];
  const teammateIds = [...new Set(rawTeammates.filter(Boolean))].slice(
    0,
    champ.maxTeamSize - 1,
  );

  const allDriverIds = [driver.id, ...teammateIds];
  if (allDriverIds.length > champ.maxTeamSize) {
    return { error: `Team cannot exceed ${champ.maxTeamSize} drivers` };
  }

  // ── 5. Validate each teammate: exists, same division, not self ────────────
  for (const teammateId of teammateIds) {
    if (teammateId === driver.id) {
      return { error: 'Cannot add yourself as a teammate' };
    }

    const { data: teammate } = await adminClient
      .from('drivers')
      .select('id, division_id')
      .eq('id', teammateId)
      .maybeSingle();

    if (!teammate) return { error: 'Selected teammate not found' };
    if (teammate.division_id !== driver.division_id) {
      return { error: 'All teammates must be in the same division as you' };
    }
  }

  // ── 6. Check registrant not already on a team ─────────────────────────────
  const { data: existingMembership } = await adminClient
    .from('team_members')
    .select('id')
    .eq('driver_id', driver.id)
    .eq('championship_key', champKey!)
    .eq('season', champ.registrationSeason)
    .maybeSingle();

  if (existingMembership) {
    return { error: 'You are already registered for this championship' };
  }

  // ── 7. Insert team — division_id server-derived, never client-supplied ────
  const { data: team, error: teamErr } = await adminClient
    .from('team_registrations')
    .insert({
      championship_key: champKey!,
      season: champ.registrationSeason,
      team_name: teamName,
      division_id: driver.division_id,
      car,
    })
    .select('id')
    .single();

  if (teamErr) {
    if (teamErr.code === '23505') {
      return { error: 'A team with that name already exists — choose a different name' };
    }
    return { error: teamErr.message };
  }

  // ── 8. Insert members — UNIQUE constraint catches double-claims atomically ─
  const memberRows = allDriverIds.map((dId) => ({
    team_id: team.id,
    driver_id: dId,
    championship_key: champKey!,
    season: champ.registrationSeason!,
  }));

  const { error: membersErr } = await adminClient
    .from('team_members')
    .insert(memberRows);

  if (membersErr) {
    // Roll back the team insert (cascade deletes any members that did insert)
    await adminClient.from('team_registrations').delete().eq('id', team.id);
    if (membersErr.code === '23505') {
      return {
        error:
          'One or more selected drivers are already on a team for this championship',
      };
    }
    return { error: membersErr.message };
  }

  revalidatePath(`/${simSlug}/register`);
  redirect(`/${simSlug}/register`);
}

export async function leaveTeam(teamId: string, simSlug: string): Promise<void> {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // ── 2. Get driver ─────────────────────────────────────────────────────────
  const { data: driver } = await adminClient
    .from('drivers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!driver) return;

  // ── 3. Verify driver is on this team (prevents cross-team tampering) ──────
  const { data: membership } = await adminClient
    .from('team_members')
    .select('id')
    .eq('team_id', teamId)
    .eq('driver_id', driver.id)
    .maybeSingle();
  if (!membership) return;

  // ── 4. Remove from team — team persists under-filled ─────────────────────
  await adminClient
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('driver_id', driver.id);

  revalidatePath(`/${simSlug}/register`);
}
