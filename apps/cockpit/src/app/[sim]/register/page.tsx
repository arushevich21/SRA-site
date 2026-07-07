import { type ReactNode } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabase as adminClient } from '@/lib/supabase';
import { getSimBySlug } from '@/content/sims';
import { CHAMPIONSHIPS } from '@/content/championships';
import RegisterForm from './RegisterForm';
import CurrentTeam from './CurrentTeam';
import TeamList, { type Team } from './TeamList';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ sim: string }> };

// Supabase FK join inference — cast via as unknown as
type RawMemberJoin = {
  driver_id: string;
  drivers: { display_name: string | null; tier: string | null } | null;
};
type RawTeamJoin = {
  id: string;
  team_name: string;
  car: string;
  division_id: number;
  divisions: { name: string } | null;
  team_members: RawMemberJoin[] | null;
};

export default async function RegisterPage({ params }: Props) {
  const { sim: simSlug } = await params;
  const sim = getSimBySlug(simSlug);
  if (!sim) notFound();

  const champ = CHAMPIONSHIPS.find(
    (c) => c.game === sim.game && c.registrationKey && c.registrationOpen,
  );

  if (
    !champ?.registrationKey ||
    !champ.registrationSeason ||
    !champ.maxTeamSize ||
    !champ.allowedCars
  ) {
    return (
      <Shell sim={sim} title="Register">
        <p className="font-mono text-[13px] text-txt-3">
          Registration is currently closed for {sim.displayName}.
        </p>
      </Shell>
    );
  }

  // ── Public: fetch all registered teams (no auth needed) ───────────────────
  const { data: rawTeams } = await adminClient
    .from('team_registrations')
    .select(
      'id, team_name, car, division_id, divisions(name), team_members(driver_id, drivers(display_name, tier))',
    )
    .eq('championship_key', champ.registrationKey)
    .eq('season', champ.registrationSeason)
    .order('team_name');

  const teams: Team[] = ((rawTeams ?? []) as unknown as RawTeamJoin[]).map(
    (r) => ({
      id: r.id,
      team_name: r.team_name,
      car: r.car,
      division_id: r.division_id,
      division_name:
        (r.divisions as unknown as { name: string } | null)?.name ??
        `Division ${r.division_id}`,
      members: ((r.team_members ?? []) as unknown as RawMemberJoin[]).map(
        (m) => ({
          driver_id: m.driver_id,
          display_name:
            (
              m.drivers as unknown as {
                display_name: string | null;
              } | null
            )?.display_name ?? null,
          tier: (
            (m.drivers as unknown as { tier: string | null } | null)?.tier ??
            null
          ) as 'gold' | 'silver' | null,
        }),
      ),
    }),
  );

  // Derive taken set from fetched teams — avoids a separate team_members query
  const takenSet = new Set(
    teams.flatMap((t) => t.members.map((m) => m.driver_id)),
  );

  // ── Auth ───────────────────────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userSection: ReactNode;

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

    if (!driver?.division_id) {
      userSection = (
        <div className="max-w-[480px] border border-line bg-panel px-6 py-5">
          <p className="font-mono text-[11px] tracking-[.3em] uppercase text-gold-deep mb-3">
            Division Required
          </p>
          <p className="font-mono text-[13px] text-txt-2 leading-relaxed">
            You need a division assigned before registering. Contact an admin in
            Discord to get assigned.
          </p>
          <p className="font-mono text-[11px] text-txt-3 mt-3">
            Signed in as{' '}
            <span className="text-txt">
              {driver?.display_name ?? user.email}
            </span>
          </p>
        </div>
      );
    } else {
      // Derive team membership from the already-fetched teams list
      const myTeam = teams.find((t) =>
        t.members.some((m) => m.driver_id === driver.id),
      );

      if (myTeam) {
        userSection = (
          <CurrentTeam
            teamId={myTeam.id}
            teamName={myTeam.team_name}
            car={myTeam.car}
            divisionName={myTeam.division_name}
            members={myTeam.members}
            currentDriverId={driver.id}
            simSlug={simSlug}
            maxTeamSize={champ.maxTeamSize}
          />
        );
      } else {
        const { data: divisionDrivers } = await adminClient
          .from('drivers')
          .select('id, display_name, tier')
          .eq('division_id', driver.division_id)
          .neq('id', driver.id)
          .order('display_name', { nullsFirst: false });

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
            />
          </>
        );
      }
    }
  }

  return (
    <Shell sim={sim} title={champ.title}>
      <div className="mb-16">{userSection}</div>
      <div className="border-t border-line pt-12">
        <p className="font-mono text-[11px] tracking-[.3em] uppercase text-txt-3 mb-8">
          Entry List
        </p>
        <TeamList teams={teams} maxTeamSize={champ.maxTeamSize} />
      </div>
    </Shell>
  );
}

function Shell({
  sim,
  title,
  children,
}: {
  sim: { accentColor: string };
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span
        className="block font-mono text-[15px] tracking-[.3em] uppercase mb-5"
        style={{ color: sim.accentColor }}
      >
        — Register
      </span>
      <h1 className="font-display font-black text-[clamp(36px,5vw,64px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-12">
        {title}
      </h1>
      {children}
    </section>
  );
}
