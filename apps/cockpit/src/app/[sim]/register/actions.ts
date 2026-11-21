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
  SOLO_NOT_PERMITTED:
    'This championship requires a teammate. If you cannot find one, ask an admin in ' +
    '#admin-help to enable solo registration for you.',
  TEAM_TOO_LARGE: 'Too many drivers for this championship',
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
  //
  // Division agreement is gated on requiresDivision, same as the teammate
  // picker above (RegisterBody.tsx) and register_entry() itself (only raises
  // DIVISION_MISMATCH `IF v_requires_division`). This check used to run
  // unconditionally, which meant a division-less championship (LIAW,
  // Endurance) rejected perfectly legal cross-division pairings client-side
  // before register_entry() — which would have allowed them — ever ran.
  const requiresDivision = champ.requiresDivision !== false;
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
    if (requiresDivision && teammate.division_id !== driver.division_id) {
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
  // call (see register_entry(), 20260814d/e/f). The roster is passed whole;
  // register_entry() decides the row shape from championships.shared_car —
  // one registrations row per driver (GT3 Team Series) or one shared row
  // (Endurance). See 20260915.
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

export type WithdrawState = { error: string } | { success: true };

// A driver withdrawing THEMSELVES from an event — the rest of their team
// stays entered. Works while sign-ups are open and after they close (until
// the championship is concluded): the closed window is exactly when a driver
// finds out they can't make the race, and before this existed the only way
// out was an admin editing the ACCSM grid by hand, which the next entrylist
// push then overwrote (or refused to touch, for an unmanaged grid).
//
// What happens to the grid, per championship shape (see 20260915):
//   * shared car (Endurance): the car stays, minus this driver. If they were
//     the last driver on it, the car is removed.
//   * car per driver (GT3 Team Series, LIAW): this driver's own car is
//     removed; teammates keep theirs, still under the team name.
// The registrations / registration_drivers triggers queue the entrylist push,
// so ACCSM picks the change up without anyone touching it.
export async function withdrawFromTeam(
  teamId: string,
  championshipKey: string,
  season: string,
  simSlug: string,
): Promise<WithdrawState> {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be signed in' };

  // ── 2. Championship must still be live ─────────────────────────────────────
  // Results for a concluded event hang off its entry list; withdrawing
  // afterwards would only rewrite history.
  const champ = (await getChampionships()).find(
    (c) => c.registrationKey === championshipKey && c.registrationSeason === season,
  );
  if (!champ) return { error: 'Championship not found' };
  if (champ.concluded) return { error: 'This championship has concluded — contact an admin' };

  // ── 3. Get driver ─────────────────────────────────────────────────────────
  const { data: driver } = await adminClient
    .from('drivers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!driver) return { error: 'Driver record not found — contact an admin' };

  // Every registrations row for this team+event — needed for both the
  // membership check below and the cleanup in step 6. Plural: on a
  // car-per-driver championship (GT3 Team Series, championships.shared_car =
  // false) a team is one row per driver sharing team_id; on a shared-car one
  // it's a single row. See 20260915.
  const { data: registrationRows, error: rowsError } = await adminClient
    .from('registrations')
    .select('id')
    .eq('team_id', teamId)
    .eq('championship_key', championshipKey)
    .eq('season', season);
  if (rowsError) return { error: 'Failed to load your registration — try again' };
  const registrationIds = (registrationRows ?? []).map((r) => r.id as string);
  if (registrationIds.length === 0) return { error: 'Registration not found' };

  // ── 4. Verify driver is on this team (prevents cross-team tampering) ──────
  // registration_drivers, not team_members: register_entry() has never
  // written team_members (the fold-in migration 20260814f was never run), so
  // checking it made this a silent no-op for every real registrant.
  const { data: membership } = await adminClient
    .from('registration_drivers')
    .select('driver_id')
    .in('registration_id', registrationIds)
    .eq('driver_id', driver.id)
    .maybeSingle();
  if (!membership) return { error: "You're not on this team" };

  // ── 5. Remove this driver's claim ──────────────────────────────────────────
  // A DELETE, not a status flag — a soft-delete would leave
  // registration_drivers_one_claim_per_event permanently blocking
  // re-registration. team_members is best-effort (normally empty, see step 4).
  await adminClient
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('driver_id', driver.id);

  const { error: claimError } = await adminClient
    .from('registration_drivers')
    .delete()
    .eq('driver_id', driver.id)
    .eq('championship_key', championshipKey)
    .eq('season', season);
  if (claimError) return { error: 'Failed to withdraw — contact an admin' };

  // ── 6. Tidy what's left ────────────────────────────────────────────────────
  // Deleting the claim does NOT delete the parent registrations row (no
  // cascade in that direction). Left alone, a vacated car keeps showing in the
  // public entry list with zero members and keeps a max_registrations slot.
  const { data: remaining } = await adminClient
    .from('registration_drivers')
    .select('registration_id, driver_id, slot')
    .in('registration_id', registrationIds);
  const stillOccupied = new Set((remaining ?? []).map((r) => r.registration_id as string));
  const emptyIds = registrationIds.filter((id) => !stillOccupied.has(id));
  if (emptyIds.length > 0) {
    await adminClient.from('registrations').delete().in('id', emptyIds);
  }

  // Close the slot gap on a shared car the leaver didn't empty. The entrylist
  // builder sorts by slot, so a gap alone doesn't break it — but slot 0 is the
  // car's primary driver (race-number fallback, admin tools), and leaving it
  // vacant meant whoever happened to sort first silently inherited that role.
  // Renumber 0..n-1 in the existing order so it's explicit.
  const byRegistration = new Map<string, { driver_id: string; slot: number }[]>();
  for (const r of remaining ?? []) {
    const list = byRegistration.get(r.registration_id as string) ?? [];
    list.push({ driver_id: r.driver_id as string, slot: Number(r.slot) });
    byRegistration.set(r.registration_id as string, list);
  }
  for (const [registrationId, drivers] of byRegistration) {
    const ordered = [...drivers].sort((a, b) => a.slot - b.slot);
    for (const [i, d] of ordered.entries()) {
      if (d.slot === i) continue;
      await adminClient
        .from('registration_drivers')
        .update({ slot: i })
        .eq('registration_id', registrationId)
        .eq('driver_id', d.driver_id);
    }
  }

  // Once nobody is left on the team anywhere (not just this one event),
  // release the name so a driver can register again under it instead of
  // hitting teams_name_unique against their own abandoned team.
  const [{ count: memberCount }, { count: registrationCount }] = await Promise.all([
    adminClient
      .from('team_members')
      .select('driver_id', { count: 'exact', head: true })
      .eq('team_id', teamId),
    adminClient
      .from('registrations')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId),
  ]);
  if ((memberCount ?? 0) === 0 && (registrationCount ?? 0) === 0) {
    await adminClient.from('teams').delete().eq('id', teamId);
  }

  revalidatePath(`/${simSlug}/register`);
  return { success: true };
}

export type UpdateRegistrationState = { error: string } | { success: true } | null;

// Lets an already-registered driver change their team's name and/or car
// without leaving and re-registering — e.g. swapping cars mid-LIAW. Deliberately
// separate from registerTeam()/register_entry(): this only ever touches an
// EXISTING team's own registrations/teams rows, never creates a new claim, so
// none of register_entry()'s claim/division/roster invariants are relevant
// here — a plain update is enough.
export async function updateRegistration(
  _prevState: UpdateRegistrationState,
  formData: FormData,
): Promise<UpdateRegistrationState> {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be signed in' };

  // ── 2. Resolve championship (for allowedCars validation + registrationKey) ─
  const champKey = formData.get('championship_key') as string | null;
  const champ = (await getChampionships()).find((c) => c.registrationKey === champKey);
  if (!champ?.registrationKey || !champ.registrationSeason || !champ.allowedCars) {
    return { error: 'Championship configuration error — contact an admin' };
  }
  // The register page stays reachable after sign-ups close (so drivers can
  // withdraw), but the grid is settled then — a late car swap would also
  // change which pre-qualifying laps count. The UI hides the edit; this is
  // the server-side half.
  if (!champ.registrationOpen) {
    return { error: 'Registration is closed — ask an admin to change your car or team name' };
  }
  const simSlug = (formData.get('sim_slug') as string | null) ?? 'acc';
  const teamId = formData.get('team_id') as string | null;
  if (!teamId) return { error: 'Missing team' };

  // ── 3. Driver + membership check — same as withdrawFromTeam(): the driver must be
  // one of this registration's actual claimed drivers (registration_drivers,
  // not team_members — see withdrawFromTeam()'s comment on why team_members can't
  // be trusted for this).
  const { data: driver } = await adminClient
    .from('drivers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!driver) return { error: 'Driver record not found — contact an admin' };

  // Plural for the same reason as withdrawFromTeam(): one row per car, and a
  // car-per-driver team has several. The car change below applies to all of
  // them — a team runs one model.
  const { data: registrationRows } = await adminClient
    .from('registrations')
    .select('id')
    .eq('team_id', teamId)
    .eq('championship_key', champ.registrationKey)
    .eq('season', champ.registrationSeason);
  const registrationIds = (registrationRows ?? []).map((r) => r.id as string);
  if (registrationIds.length === 0) return { error: 'Registration not found' };

  const { data: membership } = await adminClient
    .from('registration_drivers')
    .select('driver_id')
    .in('registration_id', registrationIds)
    .eq('driver_id', driver.id)
    .maybeSingle();
  if (!membership) return { error: "You're not on this team" };

  // ── 4. Validate + apply the car change ─────────────────────────────────────
  const car = formData.get('car') as string | null;
  if (!car || !champ.allowedCars.includes(car)) {
    return { error: 'Invalid car selection' };
  }
  const carModelId = ACC_CAR_MODEL_ID_BY_NAME[car];
  if (carModelId === undefined) {
    return {
      error: `"${car}" isn't mapped to an ACC car ID yet — an admin needs to add it to ACC_CAR_MODEL_ID_BY_NAME before this car can be selected`,
    };
  }

  const { error: carError } = await adminClient
    .from('registrations')
    .update({ car_model_id: carModelId })
    .in('id', registrationIds);
  if (carError) return { error: 'Failed to update car — contact an admin' };

  // ── 5. Validate + apply the team name change ───────────────────────────────
  const teamName = (formData.get('team_name') as string | null)?.trim();
  if (!teamName) return { error: 'Team name is required' };

  const { error: nameError } = await adminClient
    .from('teams')
    .update({ name: teamName })
    .eq('id', teamId);
  if (nameError) {
    // teams_name_unique — a case-insensitive UNIQUE INDEX on
    // (series, season, lower(name)); not tied to any one migration (predates
    // the tracked migrations directory) but confirmed live in schema.sql.
    if (nameError.code === '23505') {
      return { error: 'A team with that name already exists — choose a different name' };
    }
    return { error: 'Failed to update team name — contact an admin' };
  }

  revalidatePath(`/${simSlug}/register`);
  return { success: true };
}
