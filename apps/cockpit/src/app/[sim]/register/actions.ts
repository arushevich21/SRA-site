'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabase as adminClient } from '@/lib/supabase';
import { getChampionships } from '@/lib/championships-store';
import { ACC_CAR_MODEL_ID_BY_NAME } from '@/content/acc-car-model-map';
import { createRegistration, type RegistrationErrorCode } from '@/lib/registrations';

export type RegisterState = { error: string } | { success: true } | null;

const REGISTRATION_ERROR_MESSAGES: Record<RegistrationErrorCode, string> = {
  EMPTY_ROSTER: 'Team cannot be empty',
  DRIVER_NOT_FOUND: 'Selected teammate not found',
  DIVISION_UNASSIGNED:
    'You need a division assigned before registering — contact an admin',
  DIVISION_MISMATCH: 'All teammates must be in the same division as you',
  REGISTRANT_NOT_IN_ROSTER: 'Registration error — contact an admin',
  DRIVER_ALREADY_CLAIMED:
    'One or more selected drivers are already registered for this championship',
  UNKNOWN: 'Registration failed — contact an admin if this persists',
};

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
  const champKey = formData.get('championship_key') as string | null;
  const champ = (await getChampionships()).find((c) => c.registrationKey === champKey);
  if (!champ?.registrationOpen) {
    return { error: 'Registration is not open for this championship' };
  }
  if (!champ.registrationSeason || !champ.maxTeamSize || !champ.allowedCars) {
    return { error: 'Championship configuration error — contact an admin' };
  }
  const simSlug = (formData.get('sim_slug') as string | null) ?? 'acc';

  // ── 3. Registrant's driver record ───────────────────────────────────────────
  // division_id is NOT checked here — register_entry() derives/validates
  // division itself (DIVISION_UNASSIGNED), so this is just "does a driver
  // record exist at all".
  const { data: driver } = await adminClient
    .from('drivers')
    .select('id, division_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!driver) return { error: 'Driver record not found — contact an admin' };

  // ── 4. Validate form inputs ────────────────────────────────────────────────
  const teamName = (formData.get('team_name') as string | null)?.trim();
  const car = formData.get('car') as string | null;

  if (!teamName) return { error: 'Team name is required' };
  if (!car || !champ.allowedCars.includes(car)) {
    return { error: 'Invalid car selection' };
  }

  // Forward-compat guard, not expected to fire for today's allowedCars list
  // (all 21 are human-confirmed in ACC_CAR_MODEL_ID_BY_NAME — see that
  // file's header). Fails closed and names the exact unmapped string rather
  // than guessing a match or silently dropping car_model_id, so a new car
  // added to allowedCars without a corresponding map entry blocks
  // registration with an actionable message instead of registering with the
  // wrong car or none at all.
  const carModelId = ACC_CAR_MODEL_ID_BY_NAME[car];
  if (carModelId === undefined) {
    return {
      error: `"${car}" isn't mapped to an ACC car ID yet — an admin needs to add it to ACC_CAR_MODEL_ID_BY_NAME before this car can be selected`,
    };
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

  // ── 5. ADVISORY pre-check: exists, same division, not self ────────────────
  // NOT load-bearing — register_entry() re-derives and enforces all of this
  // server-side, atomically, inside the same transaction as the insert (see
  // lib/registrations.ts / 20260814e-f). This exists purely so a driver
  // sees "Kevin is already on another team" before submitting instead of
  // after a round-trip. Do not let this check grow teeth again — anything
  // that actually needs to be correct belongs in register_entry(), not here
  // (that's exactly the mistake this whole registration path is being
  // rebuilt to get away from).
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

  // ── 6. Resolve or create the team ──────────────────────────────────────────
  // teams has no championship_key — a team is a persistent season roster
  // (teams/team_members), independent of any one event's registration
  // (registrations/registration_drivers). Look up whether the registrant
  // already has a team for this series+season before creating a new one.
  //
  // series = champ.classTag ('GT3'), NOT ChampionshipContent.game ('ACC') —
  // INFERRED, not confirmed: registrations.series/teams.series are free
  // text with no FK/enum, and ChampionshipContent has nothing that exactly
  // matches Anton's July test seed's series value ('gt3_team_series'). Went
  // with classTag because it matches classification.series ('GT3', the
  // bot-owned, currently-live system from the hot-stint work) — the
  // strongest precedent available, but still an inference, not a value
  // read from a source of truth. Confirm before this ships.
  const { data: existingMembership } = await adminClient
    .from('team_members')
    .select('team_id, teams!inner(id, series, season)')
    .eq('driver_id', driver.id)
    .eq('teams.series', champ.classTag)
    .eq('teams.season', champ.registrationSeason)
    .maybeSingle();

  let teamId: string;
  if (existingMembership) {
    teamId = existingMembership.team_id as string;
  } else {
    const { data: newTeam, error: teamErr } = await adminClient
      .from('teams')
      .insert({ series: champ.classTag, season: champ.registrationSeason, name: teamName })
      .select('id')
      .single();

    if (teamErr) {
      // teams_unique_name_per_season (20260814f) — a presentation guard
      // (two identically-named teams in standings/entrylists), not a
      // concurrency one; the real double-claim race resolves atomically at
      // registration_drivers_one_claim_per_event inside register_entry().
      if (teamErr.code === '23505') {
        return { error: 'A team with that name already exists — choose a different name' };
      }
      return { error: teamErr.message };
    }
    teamId = newTeam.id;
  }

  // ── 7. Create the entry — division derivation, driver-claim uniqueness, ───
  // and the team_members roster write all happen atomically inside this one
  // call (see register_entry(), 20260814d/e/f).
  const result = await createRegistration({
    series: champ.classTag,
    season: champ.registrationSeason,
    championshipKey: champKey!,
    teamId,
    carModelId,
    raceNumber: null,
    entryClass: null,
    registrantDriverId: driver.id,
    drivers: allDriverIds.map((driverId) => ({ driverId })),
  });

  if (!result.ok) {
    return { error: REGISTRATION_ERROR_MESSAGES[result.errorCode] };
  }

  revalidatePath(`/${simSlug}/register`);
  redirect(`/${simSlug}/register`);
}

export async function leaveTeam(
  teamId: string,
  championshipKey: string,
  season: string,
  simSlug: string,
): Promise<void> {
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
    .select('team_id')
    .eq('team_id', teamId)
    .eq('driver_id', driver.id)
    .maybeSingle();
  if (!membership) return;

  // ── 4. Two deletes, per the roster/entry split ─────────────────────────────
  // team_members: remove from the persistent roster.
  // registration_drivers: remove the ACTIVE claim for this specific
  // championship+season (a DELETE, not a status flag — a soft-delete would
  // leave the unique constraint permanently blocking re-registration; see
  // registration_drivers_one_claim_per_event's migration header). Waitlisted
  // entries are deleted the same as confirmed ones — leaving a team means
  // leaving it, regardless of where the entry sat.
  await adminClient
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('driver_id', driver.id);

  await adminClient
    .from('registration_drivers')
    .delete()
    .eq('driver_id', driver.id)
    .eq('championship_key', championshipKey)
    .eq('season', season);

  revalidatePath(`/${simSlug}/register`);
}
