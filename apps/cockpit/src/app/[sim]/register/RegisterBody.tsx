import { type ReactNode } from 'react';
import Link from 'next/link';
import { accCarManufacturerIconName, accCarModelName } from '@sra/domain';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabase as adminClient } from '@/lib/supabase';
import type { ChampionshipContent, ScheduleRound } from '@/content/championships';
import type { SimConfig } from '@/content/sims';
import { eventInstant, eventDateTimeParts, hasEventTime, EVENT_SOURCE_TIMEZONE } from '@/lib/event-time';
import { accCarManufacturerLogoUrl } from '@/lib/acc/manufacturer-logo';
import RegisterForm from './RegisterForm';
import CurrentTeam, { type NextRoundInfo } from './CurrentTeam';
import TeamList, { type Team } from './TeamList';

// Supabase FK join inference — cast via as unknown as
type RawMemberJoin = {
  driver_id: string;
  drivers: { display_name: string | null; tier: string | null } | null;
};
type RawRegistrationJoin = {
  id: string;
  team_id: string;
  car_model_id: number | null;
  division_id: number | null;
  teams: { name: string } | { name: string }[] | null;
  divisions: { name: string } | { name: string }[] | null;
  registration_drivers: RawMemberJoin[] | null;
};

function one<T>(rel: T | T[] | null): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

// Sort key for a schedule entry — the real instant for a timed entry,
// midnight UTC of the authored calendar date for a date-only one (good
// enough for ordering "which round is next"; event-time.ts's DST-aware
// instant is reserved for entries that actually carry a time).
function roundSortKey(date: string): number {
  if (hasEventTime(date)) return eventInstant(date);
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

// The soonest not-yet-happened round on the schedule, or null if every round
// is undated or already past — CurrentTeam simply omits the panel then
// rather than showing a stale or empty one.
function findNextRound(schedule: ScheduleRound[]): ScheduleRound | null {
  const now = Date.now();
  return (
    schedule
      .filter((r): r is ScheduleRound & { date: string } => r.date != null)
      .map((r) => ({ round: r, key: roundSortKey(r.date) }))
      .filter((r) => r.key >= now)
      .sort((a, b) => a.key - b.key)[0]?.round ?? null
  );
}

function toNextRoundInfo(round: ScheduleRound): NextRoundInfo {
  const { date, time } = eventDateTimeParts(round.date, EVENT_SOURCE_TIMEZONE);
  return { round: round.round, track: round.track, raceLength: round.raceLength, date, time };
}

// Manufacturer icon/logo for a car, same resolution every other car display
// on the site uses (HotLapBoard, TrackHeader, jagoff's board): a
// @cardog-icons/react icon name where one exists, else our own uploaded SVG
// logo where the manufacturer has one, else neither — never a generic
// placeholder glyph. Resolved once here (a server component) and passed
// down as plain data, since Icon/FallbackLogoImage live in client
// components (TeamList, CurrentTeam).
function resolveCarLogo(carModelId: number | null): {
  manufacturerIconName: string | null;
  manufacturerLogoUrl: string | null;
} {
  if (carModelId == null) return { manufacturerIconName: null, manufacturerLogoUrl: null };
  const manufacturerIconName = accCarManufacturerIconName(carModelId);
  return {
    manufacturerIconName,
    manufacturerLogoUrl: !manufacturerIconName ? accCarManufacturerLogoUrl(carModelId) : null,
  };
}

export async function RegisterBody({
  champ,
  sim,
  simSlug,
}: {
  champ: ChampionshipContent | undefined;
  sim: SimConfig;
  simSlug: string;
}) {
  if (
    !champ?.registrationKey ||
    !champ.registrationOpen ||
    !champ.registrationSeason ||
    !champ.maxTeamSize ||
    !champ.allowedCars
  ) {
    return (
      <div className="max-w-[560px] border border-line bg-panel px-7 py-8">
        <p className="font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-4">
          Coming Soon
        </p>
        <p className="font-sans text-[15px] text-txt-2 leading-relaxed">
          Team registration for {champ?.title ?? sim.displayName} isn&apos;t
          open yet. Join our Discord to get notified the moment sign-ups go
          live.
        </p>
        <a
          href="https://discord.gg/SimRacingAlliance"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-6 font-mono text-[11px] tracking-[.2em] uppercase text-gold hover:text-gold-soft transition-colors"
        >
          Join Discord →
        </a>
      </div>
    );
  }

  // ── Public: fetch the confirmed entry list (no auth needed) ────────────────
  // registrations/registration_drivers, not team_registrations/team_members —
  // registration_drivers is authoritative for "who is in this car for this
  // event" (see supabase/migrations/20260814d-f). Waitlisted entries are
  // excluded from the public entry list (they aren't "in" the event yet),
  // but see takenSet below — a waitlisted claim still counts as taken.
  const { data: rawRegistrations } = await adminClient
    .from('registrations')
    .select(
      'id, team_id, car_model_id, division_id, teams(name), divisions(name), registration_drivers(driver_id, drivers(display_name, tier))',
    )
    .eq('championship_key', champ.registrationKey)
    .eq('season', champ.registrationSeason)
    .eq('status', 'confirmed')
    .order('id');

  const teams: Team[] = ((rawRegistrations ?? []) as unknown as RawRegistrationJoin[]).map(
    (r) => ({
      id: r.team_id,
      team_name: one(r.teams)?.name ?? 'Unnamed Team',
      car: (r.car_model_id != null ? accCarModelName(r.car_model_id) : null) ?? 'Unknown Car',
      carModelId: r.car_model_id,
      ...resolveCarLogo(r.car_model_id),
      division_id: r.division_id,
      // NULL division => ungraded entry; no name to fall back to.
      division_name:
        r.division_id == null
          ? null
          : (one(r.divisions)?.name ?? `Division ${r.division_id}`),
      members: (r.registration_drivers ?? []).map((m) => ({
        driver_id: m.driver_id,
        display_name: m.drivers?.display_name ?? null,
        tier: (m.drivers?.tier ?? null) as 'gold' | 'silver' | null,
      })),
    }),
  );

  // Every driver already CLAIMED for this event, confirmed or waitlisted —
  // register_entry()'s unique constraint blocks a second claim regardless of
  // status, so a waitlisted driver must not appear as "available" here
  // either. Queried directly against registration_drivers (denormalized
  // championship_key/season, see 20260814d), not derived from the
  // confirmed-only `teams` list above, specifically to include waitlisted
  // claims the public entry list itself doesn't show.
  const { data: claimedRows } = await adminClient
    .from('registration_drivers')
    .select('driver_id')
    .eq('championship_key', champ.registrationKey)
    .eq('season', champ.registrationSeason);
  const takenSet = new Set((claimedRows ?? []).map((r) => r.driver_id as string));

  // ── Auth ───────────────────────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userSection: ReactNode;
  // Captured inside the branch below (only known once we've resolved a
  // driver record) and read afterward by TeamList's "mine" row highlight —
  // undefined for a signed-out viewer or one with no driver record, which
  // simply never matches any entry-list row.
  let currentDriverId: string | undefined;

  if (!user) {
    userSection = (
      <div className="max-w-[480px]">
        <p className="font-mono text-[13px] text-txt-2 mb-6">
          Sign in with Discord to register your team.
        </p>
        <Link href="/auth/login" className="nav-signin inline-block">
          <span style={{ display: 'inline-block', transform: 'skewX(9deg)' }}>
            Sign In with Discord
          </span>
        </Link>
      </div>
    );
  } else {
    const { data: driver } = await adminClient
      .from('drivers')
      .select('id, display_name, division_id')
      .eq('user_id', user.id)
      .maybeSingle();
    currentDriverId = driver?.id;

    // Divisions are a GT3 Team Series concept. A championship that doesn't
    // grade its entries (League in a Week and friends) has one grid, so an
    // ungraded driver is a perfectly valid registrant — gating them out was
    // locking everyone outside the team series out of every event.
    const requiresDivision = champ.requiresDivision !== false;

    // No drivers row at all is a different problem from being ungraded, and it
    // blocks registration for EVERY championship — register_entry() would
    // raise DRIVER_NOT_FOUND. Previously `!driver?.division_id` conflated the
    // two; now that the division half is conditional, this needs saying
    // separately or an account with no driver record would fall through to the
    // form and crash on driver.id.
    if (!driver) {
      userSection = (
        <div className="max-w-[480px] border border-line bg-panel px-6 py-5">
          <p className="font-mono text-[11px] tracking-[.3em] uppercase text-gold-deep mb-3">
            Driver Record Missing
          </p>
          <p className="font-mono text-[13px] text-txt-2 leading-relaxed">
            We couldn&apos;t find a driver profile for your account. Ping an
            admin in the #admin-help channel and they&apos;ll get you sorted.
          </p>
          <a
            href="https://discord.com/channels/915686674833498203/1012438472189026404"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-4 font-mono text-[11px] tracking-[.2em] uppercase text-gold hover:text-gold-soft transition-colors"
          >
            Open #admin-help →
          </a>
          <p className="font-mono text-[11px] text-txt-3 mt-3">
            Signed in as <span className="text-txt">{user.email}</span>
          </p>
        </div>
      );
    } else if (requiresDivision && !driver.division_id) {
      userSection = (
        <div className="max-w-[480px] border border-line bg-panel px-6 py-5">
          <p className="font-mono text-[11px] tracking-[.3em] uppercase text-gold-deep mb-3">
            Division Required
          </p>
          <p className="font-mono text-[13px] text-txt-2 leading-relaxed">
            You need a division assigned before registering. Ping an admin in
            the #admin-help channel and they&apos;ll get you sorted.
          </p>
          <a
            href="https://discord.com/channels/915686674833498203/1012438472189026404"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-4 font-mono text-[11px] tracking-[.2em] uppercase text-gold hover:text-gold-soft transition-colors"
          >
            Open #admin-help →
          </a>
          <p className="font-mono text-[11px] text-txt-3 mt-3">
            Signed in as{' '}
            <span className="text-txt">
              {driver?.display_name ?? user.email}
            </span>
          </p>
        </div>
      );
    } else {
      // Derive team membership from the already-fetched (confirmed-only)
      // teams list. NOTE: a WAITLISTED registrant (claimed via takenSet
      // above, but not in `teams` since that's confirmed-only) falls
      // through to the registration form below rather than a "you're
      // waitlisted" state — CurrentTeam/TeamList have no such state today.
      // They'd hit DRIVER_ALREADY_CLAIMED if they tried to submit again,
      // which is correct but not a good message for someone legitimately
      // waitlisted. Flagged, not built — out of scope for this pass.
      const myTeam = teams.find((t) =>
        t.members.some((m) => m.driver_id === driver.id),
      );

      if (myTeam) {
        const nextRound = findNextRound(champ.schedule);
        userSection = (
          <CurrentTeam
            teamId={myTeam.id}
            teamName={myTeam.team_name}
            car={myTeam.car}
            carModelId={myTeam.carModelId}
            manufacturerIconName={myTeam.manufacturerIconName}
            manufacturerLogoUrl={myTeam.manufacturerLogoUrl}
            divisionId={myTeam.division_id}
            divisionName={myTeam.division_name}
            members={myTeam.members}
            currentDriverId={driver.id}
            currentDriverName={driver.display_name}
            simSlug={simSlug}
            maxTeamSize={champ.maxTeamSize}
            championshipKey={champ.registrationKey}
            season={champ.registrationSeason}
            allowedCars={champ.allowedCars}
            nextRound={nextRound ? toNextRoundInfo(nextRound) : null}
          />
        );
      } else {
        // Teammate pool. Same-division only where divisions exist —
        // register_entry() enforces DIVISION_MISMATCH there, so offering
        // anyone else would just produce a rejected submit. Where they don't,
        // every driver is eligible and the filter would wrongly exclude
        // ungraded ones (division_id NULL matches no `.eq`).
        //
        // Only reached when maxTeamSize > 1; a solo championship never renders
        // a teammate picker.
        let teammateQuery = adminClient
          .from('drivers')
          .select('id, display_name, tier')
          .neq('id', driver.id);

        if (requiresDivision) {
          teammateQuery = teammateQuery.eq('division_id', driver.division_id);
        }

        const { data: divisionDrivers } = await teammateQuery.order(
          'display_name',
          { nullsFirst: false },
        );

        const availableDrivers = (
          (divisionDrivers ?? []) as {
            id: string;
            display_name: string | null;
            tier: 'gold' | 'silver' | null;
          }[]
        ).filter((d) => !takenSet.has(d.id));

        userSection = (
          <>
            <div className="mb-8">
              <p className="font-mono text-[12px] text-txt-3">
                Registering as{' '}
                <span className="text-txt">
                  {driver.display_name ?? user.email}
                </span>
                {' · '}
                <Link
                  href="/profile"
                  className="hover:text-gold transition-colors"
                >
                  edit profile
                </Link>
              </p>
            </div>
            <RegisterForm
              champKey={champ.registrationKey}
              maxTeamSize={champ.maxTeamSize}
              allowedCars={champ.allowedCars}
              simSlug={simSlug}
              availableDrivers={availableDrivers}
              existingTeamNames={teams.map((t) => t.team_name)}
            />
          </>
        );
      }
    }
  }

  return (
    <>
      <div className="mb-16">{userSection}</div>
      <div className="border-t border-line pt-12">
        <p className="font-mono text-[11px] tracking-[.3em] uppercase text-txt-3 mb-8">
          Entry List
        </p>
        <TeamList
          teams={teams}
          maxTeamSize={champ.maxTeamSize}
          showDivisions={champ.requiresDivision !== false}
          currentDriverId={currentDriverId}
        />
      </div>
    </>
  );
}
