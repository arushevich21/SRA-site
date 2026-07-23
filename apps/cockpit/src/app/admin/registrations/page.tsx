import Link from 'next/link';
import { requireAdmin } from '@/lib/require-admin';
import { supabase } from '@/lib/supabase';
import { getChampionships } from '@/lib/championships-store';
import RegistrationsAdmin, {
  type AdminChampionship,
  type AdminTeam,
} from './RegistrationsAdmin';

export const dynamic = 'force-dynamic';

// Endurance championships (formatTag "Endurance") group by admin-set class;
// everything else groups by Division 1–4. See registration-division-vs-class.
function isEnduranceChampionship(formatTag: string | undefined): boolean {
  return (formatTag ?? '').trim().toLowerCase() === 'endurance';
}

// Supabase FK-join inference — cast via `as unknown as`.
type RawMemberJoin = {
  driver_id: string;
  drivers: {
    display_name: string | null;
    steam_id: string | null;
    discord_id: string | null;
    tier: string | null;
    division_id: number | null;
    divisions: { name: string } | null;
  } | null;
};
type RawTeamJoin = {
  id: string;
  team_name: string;
  car: string;
  division_id: number | null;
  entry_class: string | null;
  divisions: { name: string } | null;
  team_members: RawMemberJoin[] | null;
};

export default async function AdminRegistrationsPage() {
  // Defense in depth: gate at page render AND every server action.
  await requireAdmin();

  // Every championship that accepts team registration — managed here whether or
  // not sign-ups are currently open (admins curate before open and after close).
  const champs = (await getChampionships()).filter(
    (c) => c.registrationKey && c.registrationSeason && c.maxTeamSize,
  );

  const championships: AdminChampionship[] = [];
  for (const champ of champs) {
    const { data: rawTeams } = await supabase
      .from('team_registrations')
      .select(
        'id, team_name, car, division_id, entry_class, divisions(name), team_members(driver_id, drivers(display_name, steam_id, discord_id, tier, division_id, divisions(name)))',
      )
      .eq('championship_key', champ.registrationKey!)
      .eq('season', champ.registrationSeason!)
      .order('team_name');

    const teams: AdminTeam[] = ((rawTeams ?? []) as unknown as RawTeamJoin[]).map(
      (r) => ({
        id: r.id,
        team_name: r.team_name,
        car: r.car,
        division_id: r.division_id,
        division_name:
          r.divisions?.name ??
          (r.division_id != null ? `Division ${r.division_id}` : null),
        entryClass: r.entry_class,
        members: (r.team_members ?? []).map((m) => ({
          driver_id: m.driver_id,
          display_name: m.drivers?.display_name ?? null,
          steam_id: m.drivers?.steam_id ?? null,
          discord_id: m.drivers?.discord_id ?? null,
          tier: (m.drivers?.tier ?? null) as 'gold' | 'silver' | null,
          divisionName:
            m.drivers?.divisions?.name ??
            (m.drivers?.division_id != null
              ? `Division ${m.drivers.division_id}`
              : null),
        })),
      }),
    );

    championships.push({
      key: champ.registrationKey!,
      season: champ.registrationSeason!,
      title: champ.title,
      maxTeamSize: champ.maxTeamSize!,
      registrationOpen: Boolean(champ.registrationOpen),
      grouping: isEnduranceChampionship(champ.formatTag) ? 'class' : 'division',
      teams,
    });
  }

  return (
    <Shell>
      {championships.length === 0 ? (
        <div className="border border-line/50 bg-carbon-2 px-8 py-12 text-center">
          <p className="font-mono text-[13px] tracking-[.2em] uppercase text-txt-3">
            No championships accept registration yet
          </p>
        </div>
      ) : (
        <RegistrationsAdmin championships={championships} />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="max-w-[1400px] mx-auto px-7 pt-14 pb-24">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 hover:text-gold transition-colors mb-5"
      >
        ← Go back
      </Link>
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">
        — Admin
      </span>
      <h1 className="font-display font-black text-[clamp(36px,5vw,56px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-10">
        Registrations
      </h1>
      {children}
    </section>
  );
}
