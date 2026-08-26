import Link from 'next/link';
import { requireAdmin } from '@/lib/require-admin';
import { accCarModelName } from '@sra/domain';
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
  car_model_id: number | null;
  division_id: number | null;
  entry_class: string | null;
  status: string;
  waitlist_position: number | null;
  teams: { name: string } | { name: string }[] | null;
  divisions: { name: string } | { name: string }[] | null;
  registration_drivers: RawMemberJoin[] | null;
};

// A to-one FK join comes back as an object or a single-element array depending
// on how PostgREST infers the relationship; normalise both.
function one<T>(rel: T | T[] | null): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

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
    // registrations / registration_drivers — the tables register_entry()
    // actually writes. This page read team_registrations / team_members until
    // 2026-08-26, which have held zero rows since 20260814d-f, so it listed
    // nothing for every championship (and its actions no-oped against them).
    //
    // Waitlisted entries are included here, unlike the public entry list: the
    // whole point of this page is for an admin to see and act on them.
    const { data: rawTeams } = await supabase
      .from('registrations')
      .select(
        'id, car_model_id, division_id, entry_class, status, waitlist_position, teams(name), divisions(name), registration_drivers(driver_id, drivers(display_name, steam_id, discord_id, tier, division_id, divisions(name)))',
      )
      .eq('championship_key', champ.registrationKey!)
      .eq('season', champ.registrationSeason!)
      .order('status')
      .order('waitlist_position', { nullsFirst: true });

    const teams: AdminTeam[] = ((rawTeams ?? []) as unknown as RawTeamJoin[]).map(
      (r) => ({
        id: r.id,
        team_name: one(r.teams)?.name ?? 'Unnamed Team',
        car:
          (r.car_model_id != null ? accCarModelName(r.car_model_id) : null) ??
          'Unknown Car',
        division_id: r.division_id,
        division_name:
          one(r.divisions)?.name ??
          (r.division_id != null ? `Division ${r.division_id}` : null),
        entryClass: r.entry_class,
        status: r.status === 'waitlisted' ? 'waitlisted' : 'confirmed',
        waitlistPosition: r.waitlist_position,
        members: (r.registration_drivers ?? []).map((m) => ({
          driver_id: m.driver_id,
          display_name: m.drivers?.display_name ?? null,
          steam_id: m.drivers?.steam_id ?? null,
          discord_id: m.drivers?.discord_id ?? null,
          tier: (m.drivers?.tier ?? null) as 'gold' | 'silver' | null,
          divisionName:
            one(m.drivers?.divisions ?? null)?.name ??
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
      grouping: isEnduranceChampionship(champ.formatTag)
        ? 'class'
        // An ungraded championship has no divisions to group by; everything
        // lands in one list. See championships.requires_division.
        : champ.requiresDivision === false
          ? 'none'
          : 'division',
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
