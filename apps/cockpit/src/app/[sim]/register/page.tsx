import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabase as adminClient } from '@/lib/supabase';
import { getSimBySlug } from '@/content/sims';
import { CHAMPIONSHIPS } from '@/content/championships';
import RegisterForm from './RegisterForm';
import CurrentTeam from './CurrentTeam';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ sim: string }> };

export default async function RegisterPage({ params }: Props) {
  const { sim: simSlug } = await params;
  const sim = getSimBySlug(simSlug);
  if (!sim) notFound();

  // Find the first open registration for this sim
  const champ = CHAMPIONSHIPS.find(
    (c) => c.game === sim.game && c.registrationKey && c.registrationOpen,
  );

  if (
    !champ ||
    !champ.registrationKey ||
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

  // ── Auth check ─────────────────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Shell sim={sim} title={champ.title}>
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
      </Shell>
    );
  }

  // ── Driver record ──────────────────────────────────────────────────────────
  const { data: driver } = await adminClient
    .from('drivers')
    .select('id, display_name, division_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!driver?.division_id) {
    return (
      <Shell sim={sim} title={champ.title}>
        <div className="max-w-[480px] border border-line bg-panel px-6 py-5">
          <p className="font-mono text-[11px] tracking-[.3em] uppercase text-gold-deep mb-3">
            Division Required
          </p>
          <p className="font-mono text-[13px] text-txt-2 leading-relaxed">
            You need a division assigned before registering.
            Contact an admin in Discord to get assigned.
          </p>
          <p className="font-mono text-[11px] text-txt-3 mt-3">
            Signed in as{' '}
            <span className="text-txt">{driver?.display_name ?? user.email}</span>
          </p>
        </div>
      </Shell>
    );
  }

  // ── Already on a team? ─────────────────────────────────────────────────────
  const { data: membership } = await adminClient
    .from('team_members')
    .select('team_id')
    .eq('driver_id', driver.id)
    .eq('championship_key', champ.registrationKey)
    .eq('season', champ.registrationSeason)
    .maybeSingle();

  if (membership) {
    const [{ data: teamRow }, { data: memberRows }] = await Promise.all([
      adminClient
        .from('team_registrations')
        .select('id, team_name, car, division_id, divisions(name)')
        .eq('id', membership.team_id)
        .single(),
      adminClient
        .from('team_members')
        .select('driver_id, drivers(display_name, tier)')
        .eq('team_id', membership.team_id),
    ]);

    type RawMember = {
      driver_id: string;
      drivers: { display_name: string | null; tier: string | null } | null;
    };

    const members = ((memberRows ?? []) as unknown as RawMember[]).map((m) => ({
      driver_id: m.driver_id,
      display_name: m.drivers?.display_name ?? null,
      tier: (m.drivers?.tier ?? null) as 'gold' | 'silver' | null,
    }));

    const divisionName =
      (teamRow?.divisions as unknown as { name: string } | null)?.name ?? null;

    return (
      <Shell sim={sim} title={champ.title}>
        <CurrentTeam
          teamId={membership.team_id}
          teamName={teamRow?.team_name ?? ''}
          car={teamRow?.car ?? ''}
          divisionName={divisionName}
          members={members}
          currentDriverId={driver.id}
          simSlug={simSlug}
          maxTeamSize={champ.maxTeamSize}
        />
      </Shell>
    );
  }

  // ── Registration form ──────────────────────────────────────────────────────
  // Fetch taken driver IDs for this championship+season
  const { data: takenRows } = await adminClient
    .from('team_members')
    .select('driver_id')
    .eq('championship_key', champ.registrationKey)
    .eq('season', champ.registrationSeason);

  const takenSet = new Set((takenRows ?? []).map((r) => r.driver_id));

  // Available = same division, not self, not already claimed
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

  return (
    <Shell sim={sim} title={champ.title}>
      <div className="mb-8">
        <p className="font-mono text-[12px] text-txt-3">
          Registering as{' '}
          <span className="text-txt">{driver.display_name ?? user.email}</span>
          {' · '}
          <Link href="/profile" className="hover:text-gold transition-colors">
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
  children: React.ReactNode;
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
